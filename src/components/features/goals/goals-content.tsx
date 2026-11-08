'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/supabase/auth-context';
import { dayStreak, goalProgress, type Goal, type GoalPeriod, type MetricPoint } from '@/lib/goals';
import { collectPoints, type MetricEntry } from '@/lib/metrics';

interface EntryRow {
  id: string;
  created_at: string;
  metadata?: { dashboard_metrics?: Array<{ key?: string; value?: unknown }> };
}

interface Report {
  id?: string;
  summary: string;
  content: string;
  insights: Array<{ type: string; text: string; emoji: string }>;
}

const EMPTY_GOAL = { name: '', metric: 'steps', unit: 'steps', target: '', period: 'day' as GoalPeriod };
const PAGES_TO_LOAD = 4; // up to 200 recent entries is enough for a week of logs

/** Goals content: progress, logging, and the weekly retro. Used by the Goals route and Insights' Goals tab. */
export function GoalsContent() {
  const { accessToken } = useAuth();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [points, setPoints] = useState<MetricPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState(EMPTY_GOAL);
  const [logGoalId, setLogGoalId] = useState<string>('');
  const [logValue, setLogValue] = useState('');
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' } : null),
    [accessToken],
  );

  const load = useCallback(async () => {
    if (!headers) return;
    setLoading(true);
    setError(null);
    try {
      const goalsRes = await fetch('/api/goals', { headers });
      if (!goalsRes.ok) throw new Error('Could not load goals');
      const { goals: loaded } = (await goalsRes.json()) as { goals: Goal[] };
      setGoals(loaded);
      setLogGoalId((id) => id || loaded[0]?.id || '');

      const loadedEntries: MetricEntry[] = [];
      let before: string | null = null;
      for (let page = 0; page < PAGES_TO_LOAD; page++) {
        const url = `/api/entries?limit=50${before ? `&before=${before}` : ''}`;
        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error('Could not load entries');
        const body = (await res.json()) as { entries: EntryRow[]; has_more: boolean; next_cursor: string | null };
        loadedEntries.push(...(body.entries as MetricEntry[]));
        if (!body.has_more || !body.next_cursor) break;
        before = body.next_cursor;
      }
      setNow(new Date());
      setPoints(collectPoints(loadedEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [headers]);

  useEffect(() => {
    void load();
  }, [load]);

  const progress = useMemo(
    () => goals.map((g) => ({ ...goalProgress(g, points, now), streak: dayStreak(g, points, now) })),
    [goals, points, now],
  );

  async function saveGoals(next: Goal[]) {
    if (!headers) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/goals', { method: 'PUT', headers, body: JSON.stringify({ goals: next }) });
    setBusy(false);
    if (!res.ok) {
      setError('Could not save goals. Check the fields and try again.');
      return;
    }
    setGoals(next);
  }

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    const target = Number(draft.target);
    const next: Goal = {
      id: crypto.randomUUID(),
      name: draft.name.trim(),
      metric: draft.metric.trim().toLowerCase(),
      unit: draft.unit.trim(),
      target,
      period: draft.period,
    };
    await saveGoals([...goals, next]);
    setDraft(EMPTY_GOAL);
    setLogGoalId((id) => id || next.id);
  }

  async function removeGoal(id: string) {
    await saveGoals(goals.filter((g) => g.id !== id));
  }

  async function logProgress(e: React.FormEvent) {
    e.preventDefault();
    const goal = goals.find((g) => g.id === logGoalId);
    const value = Number(logValue);
    if (!goal || !headers || !Number.isFinite(value) || value <= 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/entries', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content: `${value} ${goal.unit} · ${goal.name}`,
        category: 'uncategorized',
        metadata: {
          dashboard_metrics: [{ key: goal.metric, label: goal.name, value, unit: goal.unit, aggregate: 'sum' }],
        },
      }),
    });
    setBusy(false);
    if (!res.ok) {
      setError('Could not save this entry.');
      return;
    }
    setLogValue('');
    await load();
  }

  async function makeRetro() {
    if (!headers) return;
    setBusy(true);
    setError(null);
    const res = await fetch('/api/reports', { method: 'POST', headers, body: JSON.stringify({ period_type: 'weekly' }) });
    setBusy(false);
    const body = (await res.json().catch(() => ({}))) as { report?: Report; error?: string };
    if (res.status === 422) {
      setError('No entries in the last 7 days yet. Log something first.');
      return;
    }
    if (!res.ok || !body.report) {
      setError('Could not build the retro. Try again.');
      return;
    }
    setReport(body.report);
  }

  return (
    <>
      <div className="flex flex-col gap-6 px-4 pb-24 pt-4">
        {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

        <section aria-labelledby="progress-h" className="flex flex-col gap-3">
          <h2 id="progress-h" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">This period</h2>
          {loading ? <p className="text-sm text-muted-foreground">Loading…</p> : null}
          {!loading && goals.length === 0 ? (
            <p className="text-sm text-muted-foreground">No goals yet. Add one below, for example 8000 steps a day.</p>
          ) : null}
          {progress.map((p) => (
            <div key={p.goal.id} className="rounded-lg border p-4">
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{p.goal.name}</p>
                <span className="text-sm text-muted-foreground">
                  {Math.round(p.current)} / {p.target} {p.goal.unit} · {p.goal.period === 'day' ? 'today' : 'this week'}
                </span>
              </div>
              <div
                role="progressbar"
                aria-label={`${p.goal.name} progress`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(p.ratio * 100)}
                className="mt-3 h-2 w-full overflow-hidden rounded-full bg-muted"
              >
                <div className="h-full bg-primary transition-all" style={{ width: `${p.ratio * 100}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{p.met ? 'Goal met' : 'Not yet'}{p.goal.period === 'day' && p.streak > 0 ? ` · ${p.streak}-day streak` : ''}</span>
                <button type="button" onClick={() => removeGoal(p.goal.id)} className="underline" disabled={busy}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </section>

        {goals.length > 0 ? (
          <section aria-labelledby="log-h" className="flex flex-col gap-3">
            <h2 id="log-h" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Log progress</h2>
            <form onSubmit={logProgress} className="flex flex-col gap-3">
              <label htmlFor="log-goal" className="text-sm">Goal</label>
              <select
                id="log-goal"
                value={logGoalId}
                onChange={(e) => setLogGoalId(e.target.value)}
                className="h-11 rounded-md border bg-background px-3"
              >
                {goals.map((g) => (
                  <option key={g.id} value={g.id}>{g.name} ({g.unit})</option>
                ))}
              </select>
              <label htmlFor="log-value" className="text-sm">Amount</label>
              <input
                id="log-value"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                required
                value={logValue}
                onChange={(e) => setLogValue(e.target.value)}
                className="h-11 rounded-md border bg-background px-3"
              />
              <Button type="submit" disabled={busy || !logValue} className="h-11">Save</Button>
            </form>
          </section>
        ) : null}

        <section aria-labelledby="retro-h" className="flex flex-col gap-3">
          <h2 id="retro-h" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Weekly retro</h2>
          <Button variant="outline" onClick={makeRetro} disabled={busy || !headers} className="h-11">
            Make this week&apos;s retro
          </Button>
          {report ? (
            <article className="flex flex-col gap-3 rounded-lg border p-4">
              <p className="text-sm font-medium">{report.summary}</p>
              <ul className="flex flex-col gap-2 text-sm">
                {report.insights.map((i) => (
                  <li key={i.type}>{i.emoji} {i.text}</li>
                ))}
              </ul>
            </article>
          ) : null}
        </section>

        <section aria-labelledby="add-h" className="flex flex-col gap-3">
          <h2 id="add-h" className="text-sm font-medium uppercase tracking-wide text-muted-foreground">Add goal</h2>
          <form onSubmit={addGoal} className="flex flex-col gap-3">
            <label htmlFor="goal-name" className="text-sm">Name</label>
            <input id="goal-name" required maxLength={60} value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="h-11 rounded-md border bg-background px-3" />
            <label htmlFor="goal-metric" className="text-sm">Metric key (lowercase, e.g. steps)</label>
            <input id="goal-metric" required pattern="[a-z0-9_]+" maxLength={32} value={draft.metric}
              onChange={(e) => setDraft({ ...draft, metric: e.target.value })} className="h-11 rounded-md border bg-background px-3" />
            <label htmlFor="goal-unit" className="text-sm">Unit</label>
            <input id="goal-unit" maxLength={16} value={draft.unit}
              onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="h-11 rounded-md border bg-background px-3" />
            <label htmlFor="goal-target" className="text-sm">Target</label>
            <input id="goal-target" type="number" required min="0" step="any" value={draft.target}
              onChange={(e) => setDraft({ ...draft, target: e.target.value })} className="h-11 rounded-md border bg-background px-3" />
            <label htmlFor="goal-period" className="text-sm">Period</label>
            <select id="goal-period" value={draft.period}
              onChange={(e) => setDraft({ ...draft, period: e.target.value as GoalPeriod })} className="h-11 rounded-md border bg-background px-3">
              <option value="day">Every day</option>
              <option value="week">Every week</option>
            </select>
            <Button type="submit" disabled={busy} className="h-11">Add goal</Button>
          </form>
        </section>
      </div>
    </>
  );
}
