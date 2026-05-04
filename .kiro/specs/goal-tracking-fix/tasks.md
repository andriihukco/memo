# Goal Tracking Fix — Tasks

## Task List

- [x] 1. Add `filterEntriesByPeriod` helper to dashboard page
  - [x] 1.1 Add pure function `filterEntriesByPeriod(entries: Entry[], period?: string): Entry[]` above `GoalsTab` in `src/app/miniapp/dashboard/page.tsx`
  - [x] 1.2 Implement period cases: `'day'` → today's entries, `'week'` → last 7 days, `'month'` → last 30 days, `undefined`/`'all'` → all entries
  - [x] 1.3 Reuse existing `startOfDay` / `endOfDay` helpers for boundary computation

- [x] 2. Fix `GoalsTab` to compute per-goal period-scoped progress
  - [x] 2.1 Remove the shared `const metrics = aggregateMetrics(entries)` and `const metricByKey = new Map(...)` lines from `GoalsTab`
  - [x] 2.2 Inside the `goals.map(g => ...)` render loop, compute `periodEntries = filterEntriesByPeriod(entries, g.period)` per goal
  - [x] 2.3 Compute `const actual = aggregateMetrics(periodEntries).find(m => m.key === g.key)` (or use a local map) per goal
  - [x] 2.4 Use the per-goal `actual` value for `pct` calculation instead of the shared `metricByKey` lookup
  - [x] 2.5 Verify the empty-state branch (`goals.length === 0`) is unaffected

- [x] 3. Extend `GOAL_KEYWORDS` regex in classifier
  - [x] 3.1 Open `src/lib/classifier.ts` and locate the `GOAL_KEYWORDS` constant
  - [x] 3.2 Add `планую`, `намір`, `маю ціль`, `цільовий` to the Ukrainian alternatives
  - [x] 3.3 Add `aim to`, `trying to`, `working on` to the English alternatives
  - [x] 3.4 Verify the regex flag is still `/i` (case-insensitive) and the existing patterns are preserved

- [x] 4. Add goal/period validation to `POST /api/widgets`
  - [x] 4.1 Open `src/app/api/widgets/route.ts` and locate the `direct` branch inside the `POST` handler
  - [x] 4.2 Before the `filtered.push(widget)` line, add validation: if `direct.goal` is defined and `Number(direct.goal) <= 0` or not finite, return HTTP 400 with `{ error: 'goal must be a positive number' }`
  - [x] 4.3 Add validation: if `direct.period` is defined and not in `['day', 'week', 'month']`, return HTTP 400 with `{ error: 'period must be one of: day, week, month' }`
  - [x] 4.4 Ensure valid requests (goal > 0, valid period) still succeed with HTTP 200

- [x] 5. Write unit tests for `filterEntriesByPeriod`
  - [x] 5.1 Create or extend `src/__tests__/goal-tracking-fix.test.ts`
  - [x] 5.2 Test `period: 'day'` — entries from today are included, entries from yesterday are excluded
  - [x] 5.3 Test `period: 'week'` — entries from 6 days ago are included, entries from 8 days ago are excluded
  - [x] 5.4 Test `period: 'month'` — entries from 29 days ago are included, entries from 31 days ago are excluded
  - [x] 5.5 Test `period: undefined` and `period: 'all'` — all entries are returned

- [x] 6. Write unit tests for GoalsTab period-scoped progress
  - [x] 6.1 Test monthly goal: entries spread across 3 months; assert `pct` uses only last-30-days sum
  - [x] 6.2 Test daily goal: entries from yesterday and today; assert `pct` uses only today's entries
  - [x] 6.3 Test widget goal with `period: 'week'`: entries from last week and older; assert progress uses only last-7-days entries
  - [x] 6.4 Test goal with no matching entries in period: assert `pct = 0` and no crash
  - [x] 6.5 Test goal where period entries exceed target: assert `pct` is capped at 100

- [x] 7. Write unit tests for extended `GOAL_KEYWORDS` regex
  - [x] 7.1 Assert `GOAL_KEYWORDS.test('Планую пробігти 100 км')` returns `true`
  - [x] 7.2 Assert `GOAL_KEYWORDS.test('Маю намір схуднути на 5 кг')` returns `true`
  - [x] 7.3 Assert `GOAL_KEYWORDS.test('Маю ціль випивати 2 літри води')` returns `true`
  - [x] 7.4 Assert `GOAL_KEYWORDS.test('Цільовий показник — 10 000 кроків')` returns `true`
  - [x] 7.5 Assert `GOAL_KEYWORDS.test("I'm trying to drink 2 litres of water daily")` returns `true`
  - [x] 7.6 Assert `GOAL_KEYWORDS.test('Working on reading 20 books this year')` returns `true`
  - [x] 7.7 Assert `GOAL_KEYWORDS.test('aim to run 5km every day')` returns `true`
  - [x] 7.8 Assert all original patterns (`ціль`, `хочу`, `мета`, `goal`, `target`, `want to`, `plan to`, etc.) still return `true`
  - [x] 7.9 Assert a neutral string like `'Сьогодні гарна погода'` returns `false`

- [x] 8. Write unit tests for widget API validation
  - [x] 8.1 Test `POST /api/widgets` with `direct: { id: 'x', goal: 0, period: 'month' }` — assert HTTP 400
  - [x] 8.2 Test `POST /api/widgets` with `direct: { id: 'x', goal: -5, period: 'week' }` — assert HTTP 400
  - [x] 8.3 Test `POST /api/widgets` with `direct: { id: 'x', goal: 10, period: 'year' }` — assert HTTP 400
  - [x] 8.4 Test `POST /api/widgets` with `direct: { id: 'x', goal: 10, period: 'month' }` — assert HTTP 200 (valid)
  - [x] 8.5 Test `POST /api/widgets` with `direct: { id: 'x' }` (no goal/period) — assert HTTP 200 (no validation triggered)

- [x] 9. Run existing test suite and verify no regressions
  - [x] 9.1 Run `npx jest --testPathPattern=classifier` and confirm all classifier tests pass
  - [x] 9.2 Run `npx jest --testPathPattern=goal-tracking-fix` and confirm all new tests pass
  - [x] 9.3 Confirm no TypeScript errors in modified files using `npx tsc --noEmit`
