# Bugfix Requirements Document

## Introduction

The Goals tab in the Memo miniapp dashboard has two related failures that cause goal progress to always display as 0%, making the feature non-functional. A third issue causes goal-related natural language entries to be silently ignored by the classifier. Together these bugs mean users who set goals via the widget UI see no progress, and users who describe goals in natural language may not have them recognized at all.

The three defects are:

1. **Data source mismatch** — Goals created via the widget UI are stored in `custom_widgets` settings, but progress is computed from `entries.metadata.goal_metrics`. These two sources are never synced, so widget-defined goals always show 0% progress.
2. **Date-filter scope mismatch** — `GoalsTab` receives `allEntries` (unfiltered) for goal definitions, but computes `metricByKey` from the same `entries` prop. When the active date range is narrow (e.g. "today") and the goal period is monthly, `metricByKey.get(g.key)` returns `undefined` and progress is 0%.
3. **Incomplete goal keyword regex** — `classifier.ts` uses a regex to detect goal-related content and route it through the metrics extraction pass. Several common Ukrainian and English goal phrases are missing, causing goal entries to skip metric extraction entirely.

---

## Bug Analysis

### Current Behavior (Defect)

1.1 WHEN a user creates a widget with a goal target (e.g. "Run 100 km this month") THEN the system stores the goal in `custom_widgets` settings but reads progress from `entries.metadata.goal_metrics`, so the two data sources are never reconciled and progress is always 0%

1.2 WHEN the dashboard date range is set to "today" or any range shorter than the goal's period THEN the system computes `metricByKey` from the date-filtered `entries`, causing `metricByKey.get(g.key)` to return `undefined` for goals whose matching entries fall outside the selected range, and progress displays as 0%

1.3 WHEN a user writes a goal entry using phrases such as "планую", "намір", "маю ціль", "aim to", "trying to", or "working on" THEN the system does not match the `GOAL_KEYWORDS` regex and skips the metrics extraction pass, so no `goal_metrics` are stored for that entry

1.4 WHEN a widget is saved with `goal = 0` or with an invalid `period` value THEN the system stores the invalid widget without error, producing a goal card with a zero denominator that causes a division-by-zero in the progress percentage calculation

### Expected Behavior (Correct)

2.1 WHEN a user creates a widget with a goal target THEN the system SHALL compute goal progress by aggregating `dashboard_metrics` from `allEntries` filtered to the goal's own period, independent of the dashboard's active date range

2.2 WHEN the dashboard date range is narrower than a goal's period THEN the system SHALL use the full unfiltered `allEntries` dataset (or a period-appropriate subset) to compute `metricByKey` inside `GoalsTab`, so that progress reflects all relevant entries regardless of the selected date filter

2.3 WHEN a user writes a goal entry using phrases "планую", "намір", "маю ціль", "цільовий", "aim to", "trying to", or "working on" THEN the system SHALL match the `GOAL_KEYWORDS` regex and route the entry through the metrics extraction pass so that `goal_metrics` are populated

2.4 WHEN a widget save request contains `goal ≤ 0` or a `period` value outside `['day', 'week', 'month']` THEN the system SHALL reject the request with HTTP 400 and an appropriate validation error message

### Unchanged Behavior (Regression Prevention)

3.1 WHEN a user creates a goal entry using already-supported keywords ("ціль", "хочу", "мета", "goal", "target", "want to", "plan to", etc.) THEN the system SHALL CONTINUE TO match the regex and extract `goal_metrics` as before

3.2 WHEN the dashboard date range is set to "all time" and goals have matching entries within that range THEN the system SHALL CONTINUE TO display correct progress percentages

3.3 WHEN a widget is saved with a valid `goal > 0` and a valid `period` THEN the system SHALL CONTINUE TO save the widget successfully and display it in the Goals tab

3.4 WHEN a user has no goals defined (neither via widgets nor via entry `goal_metrics`) THEN the system SHALL CONTINUE TO display the empty-state prompt in the Goals tab

3.5 WHEN `GoalsTab` renders goal cards for entry-based goals (sourced from `entries.metadata.goal_metrics`) THEN the system SHALL CONTINUE TO display those goals and their progress correctly

3.6 WHEN a widget is created or deleted via the widget API THEN the system SHALL CONTINUE TO enforce tier-based widget count limits as before

---

## Bug Condition Pseudocode

### Bug 1 — Data Source Mismatch

```pascal
FUNCTION isBugCondition_1(widget)
  INPUT: widget of type CustomWidget
  OUTPUT: boolean

  // Bug fires when a widget has a goal but no matching goal_metrics in entries
  RETURN widget.goal > 0
    AND NOT EXISTS entry IN allEntries WHERE entry.metadata.goal_metrics CONTAINS key = widget.metric_key
END FUNCTION

// Property: Fix Checking
FOR ALL widget WHERE isBugCondition_1(widget) DO
  result ← GoalsTab.renderProgress'(widget, allEntries)
  ASSERT result.pct = aggregateDashboardMetrics(allEntries, widget.metric_key, widget.period) / widget.goal * 100
END FOR

// Property: Preservation Checking
FOR ALL widget WHERE NOT isBugCondition_1(widget) DO
  ASSERT GoalsTab.renderProgress(widget, allEntries) = GoalsTab.renderProgress'(widget, allEntries)
END FOR
```

### Bug 2 — Date-Filter Scope Mismatch

```pascal
FUNCTION isBugCondition_2(goal, dateFilter)
  INPUT: goal of type GoalMetricAgg, dateFilter of type DateFilter
  OUTPUT: boolean

  // Bug fires when the active date range excludes entries that contribute to the goal
  RETURN dateFilter.range ≠ 'all'
    AND goal.period ≠ dateFilter.range
    AND EXISTS entry IN allEntries
      WHERE entry.created_at < dateFilter.from
        AND entry.metadata.dashboard_metrics CONTAINS key = goal.key
END FUNCTION

// Property: Fix Checking
FOR ALL (goal, dateFilter) WHERE isBugCondition_2(goal, dateFilter) DO
  result ← GoalsTab.computeMetricByKey'(goal, allEntries)
  ASSERT result ≠ undefined
  ASSERT result.value = aggregateDashboardMetrics(allEntries, goal.key, goal.period)
END FOR

// Property: Preservation Checking
FOR ALL (goal, dateFilter) WHERE NOT isBugCondition_2(goal, dateFilter) DO
  ASSERT GoalsTab.computeMetricByKey(goal, entries) = GoalsTab.computeMetricByKey'(goal, allEntries)
END FOR
```

### Bug 3 — Incomplete Goal Keyword Regex

```pascal
FUNCTION isBugCondition_3(content)
  INPUT: content of type string
  OUTPUT: boolean

  // Bug fires when content contains a goal phrase not covered by the current regex
  RETURN content MATCHES /планую|намір|маю ціль|цільовий|aim to|trying to|working on/i
    AND NOT content MATCHES CURRENT_GOAL_KEYWORDS_REGEX
END FUNCTION

// Property: Fix Checking
FOR ALL content WHERE isBugCondition_3(content) DO
  result ← classify'(content)
  ASSERT result.goal_metrics IS NOT EMPTY
END FOR

// Property: Preservation Checking
FOR ALL content WHERE NOT isBugCondition_3(content) DO
  ASSERT classify(content).goal_metrics = classify'(content).goal_metrics
END FOR
```
