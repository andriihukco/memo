# Goal Tracking Fix — Bugfix Design

## Overview

The Goals tab in the dashboard has two rendering bugs that cause goal progress to always display as 0%, plus a classifier gap that silently drops goal entries, and a missing API validation that allows corrupt widget data to be stored.

**Bug 1 — Date-filter scope mismatch**: `GoalsTab` already receives `allEntries` (the unfiltered dataset), but `aggregateMetrics(entries)` inside the component is called on the same `entries` prop — which is `allEntries`. However, the aggregation ignores the goal's own `period` field. When a goal has `period: 'month'` the progress should be computed from entries within the last 30 days, not from all time. Conversely, when the dashboard date filter is "today", the component correctly uses `allEntries` but still doesn't scope to the goal period. The fix is to compute a period-scoped metric value per goal inside `GoalsTab`.

**Bug 2 — Widget goal data source mismatch**: When a user creates a widget with `goal > 0`, the goal target is stored in `custom_widgets[].goal` inside `profiles.settings`. Progress is computed by looking up `metricByKey.get(g.key)` where `metricByKey` is built from `aggregateMetrics(entries)` — which aggregates `dashboard_metrics` from diary entries. This is correct for the value side, but the aggregation must be scoped to the goal's `period` (day/week/month/all) rather than using the full `allEntries` dataset. The fix is to compute a period-filtered aggregate for each widget goal.

**Bug 3 — Incomplete GOAL_KEYWORDS regex**: The classifier uses `GOAL_KEYWORDS` to decide whether to run the metrics extraction pass for entries in non-metric categories. Several common Ukrainian and English goal phrases are absent from the regex, causing those entries to skip Pass 2 entirely and store no `goal_metrics`.

**Bug 4 — Missing widget API validation**: `POST /api/widgets` accepts `direct` widget objects without validating that `goal > 0` and `period` is one of `['day', 'week', 'month']`. A widget stored with `goal = 0` causes a division-by-zero in the progress percentage; an invalid `period` silently produces wrong date scoping.

---

## Glossary

- **Bug_Condition (C)**: The condition that triggers the bug — the specific input or state that causes incorrect behavior.
- **Property (P)**: The desired correct behavior when the bug condition holds.
- **Preservation**: Existing correct behaviors that must remain unchanged after the fix.
- **GoalsTab**: The React component in `src/app/miniapp/dashboard/page.tsx` that renders goal progress cards.
- **allEntries**: The full unfiltered entry dataset fetched once on mount, passed to `GoalsTab` as `entries`.
- **metricByKey**: A `Map<string, AggregatedMetric>` built inside `GoalsTab` from `aggregateMetrics(entries)`.
- **goal.period**: The time window for a goal — `'day'`, `'week'`, `'month'`, or `undefined`/`'all'`.
- **GOAL_KEYWORDS**: A regex constant in `src/lib/classifier.ts` used to decide whether to run the metrics extraction pass for non-metric categories.
- **custom_widgets**: Array stored in `profiles.settings.custom_widgets`; each element may have `goal` and `period` fields.
- **dashboard_metrics**: Array stored in `entries.metadata.dashboard_metrics`; the source of truth for metric values.

---

## Bug Details

### Bug 1 & 2 — Progress Always 0% (Period Scoping)

The bug manifests when `GoalsTab` computes `metricByKey` from `aggregateMetrics(allEntries)` without filtering entries to the goal's own period. For a monthly goal, entries from all time are aggregated — which may be correct by accident — but for a daily goal, entries from all time are summed, inflating the value. More critically, when a widget goal has `period: 'month'`, the progress should reflect only the last 30 days of `dashboard_metrics` for that `metric_key`.

The second manifestation is that widget goals (`w.goal > 0`) use `metricByKey.get(g.key)` which is built from the full `allEntries` aggregate. This is wrong when the goal has a period shorter than "all time".

**Formal Specification:**
```
FUNCTION isBugCondition_period(goal, allEntries)
  INPUT: goal of type GoalMetricAgg (with period field), allEntries of type Entry[]
  OUTPUT: boolean

  periodEntries ← filterByPeriod(allEntries, goal.period)
  fullAggregate ← aggregateMetrics(allEntries).get(goal.key)
  periodAggregate ← aggregateMetrics(periodEntries).get(goal.key)

  RETURN goal.target > 0
    AND periodAggregate ≠ fullAggregate   // period scoping matters
    AND GoalsTab currently uses fullAggregate instead of periodAggregate
END FUNCTION
```

**Examples:**
- Goal: "Run 100 km this month" (`metric_key: distance_km`, `period: month`, `target: 100`). User has run 80 km total across 3 months but only 15 km this month. Bug: shows 80% (80/100). Fix: shows 15% (15/100).
- Goal: "Drink 2000 ml water today" (`metric_key: water_ml`, `period: day`, `target: 2000`). User has 1500 ml today and 5000 ml total. Bug: shows 100% (capped from 5000/2000). Fix: shows 75% (1500/2000).
- Goal: "Read 10 books this month" (`metric_key: pages_read`, `period: month`, `target: 300`). No entries today. Bug: shows 0% (date filter was "today"). Fix: shows correct monthly total.

### Bug 3 — Incomplete GOAL_KEYWORDS Regex

The current regex:
```
/ціль|хочу|мета|goal|target|want to|plan to|прочита|пробіг|схудн|набра|зробит/i
```

Missing patterns: `планую`, `намір`, `маю ціль`, `цільовий`, `aim to`, `trying to`, `working on`.

**Formal Specification:**
```
FUNCTION isBugCondition_keywords(content)
  INPUT: content of type string
  OUTPUT: boolean

  MISSING_PATTERNS ← /планую|намір|маю ціль|цільовий|aim to|trying to|working on/i
  CURRENT_REGEX    ← /ціль|хочу|мета|goal|target|want to|plan to|прочита|пробіг|схудн|набра|зробит/i

  RETURN content MATCHES MISSING_PATTERNS
    AND NOT content MATCHES CURRENT_REGEX
END FUNCTION
```

**Examples:**
- "Планую пробігти 100 км цього місяця" — not matched → no `goal_metrics` stored.
- "Маю намір схуднути на 5 кг" — not matched → no `goal_metrics` stored.
- "I'm trying to drink 2 litres of water daily" — not matched → no `goal_metrics` stored.
- "Working on reading 20 books this year" — not matched → no `goal_metrics` stored.

### Bug 4 — Missing Widget API Validation

`POST /api/widgets` with a `direct` object does not validate `goal` or `period`. A widget with `goal = 0` stored in `custom_widgets` causes `pct = actual.value / 0 * 100 = Infinity` or `NaN` in `GoalsTab`.

**Formal Specification:**
```
FUNCTION isBugCondition_validation(directWidget)
  INPUT: directWidget of type object
  OUTPUT: boolean

  RETURN (directWidget.goal IS NOT undefined AND directWidget.goal <= 0)
    OR (directWidget.period IS NOT undefined
        AND directWidget.period NOT IN ['day', 'week', 'month'])
END FUNCTION
```

---

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- Mouse clicks on metric cards and widget log-entry sheets must continue to work exactly as before.
- The dashboard date filter (today/week/month/all) must continue to control the Metrics and Finance tabs.
- Widget creation, deletion, and tier-limit enforcement must remain unchanged.
- Entry-based goals (sourced from `entries.metadata.goal_metrics`) must continue to display correctly.
- The empty-state prompt in the Goals tab must continue to appear when no goals are defined.
- All existing `GOAL_KEYWORDS` matches must continue to trigger the metrics extraction pass.
- Valid widget saves (`goal > 0`, valid `period`) must continue to succeed.

**Scope:**
All inputs that do NOT involve goal period scoping, the new keyword patterns, or invalid widget fields are completely unaffected by this fix.

---

## Hypothesized Root Cause

### Bug 1 & 2 — Period Scoping

1. **Missing period filter in GoalsTab**: `aggregateMetrics(entries)` is called once on the full `allEntries` array. There is no per-goal filtering step that restricts entries to the goal's `period` window before aggregation.

2. **Shared `metricByKey` map**: A single `metricByKey` map is built for all goals. Goals with different periods all read from the same map, so a daily goal and a monthly goal for the same metric key get the same (all-time) aggregate value.

3. **Widget goals use the same broken path**: Widget goals are merged into the same `goals` array and rendered with the same `metricByKey.get(g.key)` lookup, inheriting the same period-scoping bug.

### Bug 3 — Keyword Regex

4. **Regex was written incrementally**: The initial regex covered the most common Ukrainian goal words but was never systematically reviewed against real user input patterns. Ukrainian phrases like "планую" (I plan), "намір" (intention), "маю ціль" (I have a goal), and English phrases like "trying to" and "working on" were omitted.

### Bug 4 — API Validation

5. **Direct widget path skips validation**: The `direct` branch in `POST /api/widgets` was added as a fast path for preset widgets and simply spreads the client-provided object without any field-level validation. The AI-generated path relies on the model to produce valid values, but the direct path has no guard.

---

## Correctness Properties

Property 1: Bug Condition — Goal Progress Uses Period-Scoped Entries

_For any_ goal where `goal.target > 0` and `goal.period` is set (or defaults to `'all'`), the fixed `GoalsTab` SHALL compute the actual metric value by aggregating `dashboard_metrics` from `allEntries` filtered to the goal's own period window, independent of the dashboard's active date filter.

**Validates: Requirements 2.1, 2.2**

Property 2: Bug Condition — Widget Goals Use Period-Scoped Aggregation

_For any_ custom widget where `widget.goal > 0`, the fixed `GoalsTab` SHALL compute progress by aggregating `dashboard_metrics[metric_key]` from `allEntries` filtered to `widget.period`, not from the full unfiltered dataset.

**Validates: Requirements 2.1, 2.2**

Property 3: Bug Condition — Extended GOAL_KEYWORDS Matches New Patterns

_For any_ entry content that matches the patterns `планую`, `намір`, `маю ціль`, `цільовий`, `aim to`, `trying to`, or `working on`, the fixed classifier SHALL match `GOAL_KEYWORDS` and route the entry through the metrics extraction pass so that `goal_metrics` are populated.

**Validates: Requirements 2.3**

Property 4: Bug Condition — Widget API Rejects Invalid Goal/Period

_For any_ `POST /api/widgets` request where `direct.goal` is present and `≤ 0`, or where `direct.period` is present and not in `['day', 'week', 'month']`, the fixed API SHALL return HTTP 400 with a descriptive error message and SHALL NOT persist the widget.

**Validates: Requirements 2.4**

Property 5: Preservation — Non-Goal Dashboard Behavior Unchanged

_For any_ input that does NOT involve goal period scoping (e.g., Metrics tab, Finance tab, date filter changes), the fixed code SHALL produce exactly the same behavior as the original code.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**

Property 6: Preservation — Existing GOAL_KEYWORDS Patterns Still Match

_For any_ entry content that already matched the original `GOAL_KEYWORDS` regex, the fixed classifier SHALL continue to match and extract `goal_metrics` identically to the original behavior.

**Validates: Requirements 3.1**

---

## Fix Implementation

### Changes Required

#### File: `src/app/miniapp/dashboard/page.tsx`

**Function**: `GoalsTab`

**Specific Changes**:

1. **Add `periodFilteredEntries` helper**: Add a pure function `filterEntriesByPeriod(entries: Entry[], period?: string): Entry[]` that returns entries within the goal's period window:
   - `'day'` → entries from `startOfDay(now)` to `endOfDay(now)`
   - `'week'` → entries from 7 days ago to now
   - `'month'` → entries from 30 days ago to now
   - `undefined` / `'all'` → all entries (no filter)

2. **Compute per-goal metric value**: Inside `GoalsTab`, replace the single `aggregateMetrics(entries)` call and shared `metricByKey` map with a per-goal computation:
   ```
   for each goal g:
     periodEntries = filterEntriesByPeriod(entries, g.period)
     periodMetrics = aggregateMetrics(periodEntries)
     actual = periodMetrics.find(m => m.key === g.key)
   ```

3. **Remove shared `metricByKey` map**: The shared map is no longer needed once each goal computes its own scoped value.

4. **Update `metrics` variable**: The `metrics` variable (used for `metricByKey`) is only needed for the shared map; remove it from `GoalsTab` since each goal now computes its own.

#### File: `src/lib/classifier.ts`

**Constant**: `GOAL_KEYWORDS`

**Specific Changes**:

5. **Extend regex**: Replace:
   ```ts
   const GOAL_KEYWORDS = /ціль|хочу|мета|goal|target|want to|plan to|прочита|пробіг|схудн|набра|зробит/i;
   ```
   With:
   ```ts
   const GOAL_KEYWORDS = /ціль|хочу|мета|планую|намір|маю ціль|цільовий|goal|target|want to|plan to|aim to|trying to|working on|прочита|пробіг|схудн|набра|зробит/i;
   ```

#### File: `src/app/api/widgets/route.ts`

**Function**: `POST` handler, `direct` branch

**Specific Changes**:

6. **Add goal validation**: Before saving a `direct` widget, validate:
   ```ts
   if (direct.goal !== undefined && direct.goal !== null) {
     const goalNum = Number(direct.goal);
     if (!isFinite(goalNum) || goalNum <= 0) {
       return new Response(JSON.stringify({ error: 'goal must be a positive number' }), { status: 400 });
     }
   }
   if (direct.period !== undefined && direct.period !== null) {
     if (!['day', 'week', 'month'].includes(direct.period)) {
       return new Response(JSON.stringify({ error: 'period must be one of: day, week, month' }), { status: 400 });
     }
   }
   ```

---

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate each bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bugs BEFORE implementing the fix. Confirm or refute the root cause analysis.

**Test Plan**: Write unit tests that construct `Entry` arrays with known `dashboard_metrics` values and specific `created_at` timestamps, then render `GoalsTab` (or call the aggregation logic directly) and assert that progress percentages match the period-scoped expectation.

**Test Cases**:
1. **Monthly goal with entries spread across 3 months** (will fail on unfixed code): Create 90 entries with `distance_km` spread over 3 months. Set goal `period: 'month'`, `target: 100`. Assert `pct` equals only the last-30-days sum / 100, not the all-time sum / 100.
2. **Daily goal with historical entries** (will fail on unfixed code): Create entries for yesterday and today. Set goal `period: 'day'`, `target: 2000`. Assert `pct` uses only today's entries.
3. **Widget goal with period scoping** (will fail on unfixed code): Create a `customWidget` with `goal: 50`, `period: 'week'`, `metric_key: 'steps_count'`. Create entries with `steps_count` from last week and older. Assert progress uses only last-7-days entries.
4. **GOAL_KEYWORDS missing patterns** (will fail on unfixed code): Call `GOAL_KEYWORDS.test('Планую пробігти 100 км')` — assert `false` (demonstrates the bug).
5. **Widget API invalid goal** (will fail on unfixed code): POST `{ direct: { id: 'x', goal: 0, period: 'month' } }` — assert HTTP 200 (demonstrates missing validation).

**Expected Counterexamples**:
- `GoalsTab` shows inflated or deflated progress because it uses all-time aggregates instead of period-scoped ones.
- `GOAL_KEYWORDS.test('Планую ...')` returns `false`.
- Widget API accepts `goal: 0` without error.

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed code produces the expected behavior.

**Pseudocode:**
```
FOR ALL (goal, allEntries) WHERE isBugCondition_period(goal, allEntries) DO
  periodEntries ← filterEntriesByPeriod(allEntries, goal.period)
  expected ← aggregateMetrics(periodEntries).get(goal.key)?.value ?? 0
  actual ← GoalsTab_fixed.computeProgress(goal, allEntries)
  ASSERT actual = min(100, round(expected / goal.target * 100))
END FOR

FOR ALL content WHERE isBugCondition_keywords(content) DO
  ASSERT GOAL_KEYWORDS_fixed.test(content) = true
END FOR

FOR ALL directWidget WHERE isBugCondition_validation(directWidget) DO
  response ← POST_widgets_fixed({ direct: directWidget })
  ASSERT response.status = 400
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed code produces the same result as the original.

**Pseudocode:**
```
FOR ALL (goal, allEntries) WHERE NOT isBugCondition_period(goal, allEntries) DO
  ASSERT GoalsTab_original.computeProgress(goal, allEntries)
       = GoalsTab_fixed.computeProgress(goal, allEntries)
END FOR

FOR ALL content WHERE NOT isBugCondition_keywords(content) DO
  ASSERT GOAL_KEYWORDS_original.test(content) = GOAL_KEYWORDS_fixed.test(content)
END FOR

FOR ALL directWidget WHERE NOT isBugCondition_validation(directWidget) DO
  ASSERT POST_widgets_original(directWidget).status = POST_widgets_fixed(directWidget).status
END FOR
```

**Testing Approach**: Property-based testing is recommended for the period-scoping fix because:
- It generates many random `Entry` arrays with varied `created_at` timestamps and `dashboard_metrics` values.
- It catches edge cases like goals with no matching entries, goals where all entries are in the future, and goals with `period: undefined`.
- It provides strong guarantees that the period filter is correct across the full input domain.

### Unit Tests

- Test `filterEntriesByPeriod` with each period value (`day`, `week`, `month`, `undefined`/`all`).
- Test `GoalsTab` progress computation for a monthly goal with entries spread across multiple months.
- Test `GoalsTab` progress computation for a daily goal with entries from yesterday and today.
- Test `GoalsTab` with a widget goal (`customWidget.goal > 0`) and period-scoped entries.
- Test `GoalsTab` empty state when no goals are defined.
- Test `GOAL_KEYWORDS` regex matches all new patterns.
- Test `GOAL_KEYWORDS` regex still matches all original patterns.
- Test `POST /api/widgets` returns 400 for `goal: 0`.
- Test `POST /api/widgets` returns 400 for `goal: -5`.
- Test `POST /api/widgets` returns 400 for `period: 'year'`.
- Test `POST /api/widgets` returns 200 for valid `goal: 10`, `period: 'month'`.

### Property-Based Tests

- Generate random arrays of `Entry` objects with random `created_at` timestamps and `dashboard_metrics` values; for each generated goal with a period, assert that `filterEntriesByPeriod` returns only entries within the correct window.
- Generate random `customWidget` objects with `goal > 0` and random `period`; assert that `GoalsTab` progress never exceeds 100% and is never negative.
- Generate random content strings containing the new keyword patterns; assert `GOAL_KEYWORDS` matches all of them.
- Generate random content strings that do NOT contain any goal keywords; assert `GOAL_KEYWORDS` does not match them (preservation).

### Integration Tests

- Full flow: create a widget with `goal: 100`, `period: 'month'`, log entries via the widget log sheet, navigate to Goals tab, assert progress reflects only the current month's entries.
- Full flow: write a diary entry "Планую пробігти 100 км цього місяця", assert the entry has non-empty `goal_metrics` in the database.
- Full flow: attempt to create a widget via the UI with `goal: 0`, assert the API returns 400 and the widget is not shown in the Goals tab.
