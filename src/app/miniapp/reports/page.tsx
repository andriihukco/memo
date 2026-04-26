'use client';

import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { Icon } from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ReportInsight } from '@/lib/bot/retrospective';
import { useSound } from '@/lib/sound/use-sound';
import { SkeletonReportCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ErrorBanner as _ErrorBanner } from '@/components/ui/error-banner';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import { type SubscriptionTier } from '@/lib/stars/paywall';
import { useReportGeneration } from '@/lib/report-generation-context';

interface ReportSummary {
  id: string;
  period_type: string;
  period_from: string;
  period_to: string;
  summary: string;
  went_well?: string;
  didnt_go_well?: string;
  start_stop_continue?: string;
  experiment?: string;
  lesson?: string;
  insights: ReportInsight[];
  created_at: string;
}

// ── Retro section config ──────────────────────────────────────────────────────

const RETRO_SECTIONS = [
  { key: 'went_well' as const,           emoji: '✅', label: 'Що пройшло добре',              accent: '#34d399', bg: 'rgba(52,211,153,0.06)',  border: 'rgba(52,211,153,0.2)'  },
  { key: 'didnt_go_well' as const,       emoji: '🔴', label: 'Що не вийшло',                  accent: '#f87171', bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.2)' },
  { key: 'start_stop_continue' as const, emoji: '🔄', label: 'Почати / Зупинити / Продовжити', accent: '#60a5fa', bg: 'rgba(96,165,250,0.06)',  border: 'rgba(96,165,250,0.2)'  },
  { key: 'experiment' as const,          emoji: '🧪', label: 'Експеримент',                    accent: '#a78bfa', bg: 'rgba(167,139,250,0.06)', border: 'rgba(167,139,250,0.2)' },
  { key: 'lesson' as const,              emoji: '💡', label: 'Урок',                           accent: '#fbbf24', bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.2)'  },
] as const;

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Сьогодні', weekly: '7 днів', monthly: 'Місяць', custom: 'Звіт',
};

// ── Strip AI-generated section header from content ───────────────────────────
// The AI often starts section text with a repeated heading like "🧪 ОДИН ЕКСПЕРИМЕНТ"
// Strip ALL leading lines that look like headings before the real content starts.

function stripSectionHeader(text: string): string {
  const lines = text.split('\n');
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) { start = i + 1; continue; } // skip blank lines at top
    // Stop stripping once we hit real content (longer sentence, starts with lowercase, etc.)
    const isHeading =
      /^#{1,3}\s/.test(t) ||                          // markdown heading
      /^\p{Emoji}/u.test(t) ||                         // starts with emoji
      (t === t.toUpperCase() && /[А-ЯІЇЄҐA-Z]/.test(t)); // all-caps with letters
    if (isHeading) { start = i + 1; continue; }
    break;
  }
  return lines.slice(start).join('\n').trimStart();
}

// ── Markdown renderer ─────────────────────────────────────────────────────────
// Handles: **bold**, *italic*, bullet lists (* item), numbered lists, blank lines

function MarkdownText({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (raw: string): React.ReactNode[] => {
    // Split on **bold** and *italic*
    const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={idx} className="italic text-foreground/80">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    // Blank line → spacer
    if (!trimmed) { elements.push(<div key={`sp-${i}`} className="h-2" />); i++; continue; }

    // Bullet list item: * text or - text
    if (/^[*\-]\s+/.test(trimmed)) {
      const bulletLines: string[] = [];
      while (i < lines.length && /^[*\-]\s+/.test(lines[i].trim())) {
        bulletLines.push(lines[i].trim().replace(/^[*\-]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="space-y-1.5 my-1">
          {bulletLines.map((bl, bi) => (
            <li key={bi} className="flex items-start gap-2">
              <span className="mt-[5px] h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
              <span className="text-[15px] leading-relaxed text-foreground/90">{renderInline(bl)}</span>
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Numbered list: 1. text
    if (/^\d+\.\s+/.test(trimmed)) {
      const numLines: { n: string; text: string }[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const m = lines[i].trim().match(/^(\d+)\.\s+(.*)/);
        if (m) numLines.push({ n: m[1], text: m[2] });
        i++;
      }
      elements.push(
        <ol key={`ol-${i}`} className="space-y-1.5 my-1">
          {numLines.map((nl, ni) => (
            <li key={ni} className="flex items-start gap-2.5">
              <span className="mt-0.5 text-[12px] font-bold text-primary/70 shrink-0 w-4 text-right">{nl.n}.</span>
              <span className="text-[15px] leading-relaxed text-foreground/90">{renderInline(nl.text)}</span>
            </li>
          ))}
        </ol>
      );
      continue;
    }

    // Heading: ### or ## or #
    if (/^#{1,3}\s+/.test(trimmed)) {
      const level = (trimmed.match(/^(#+)/)?.[1].length ?? 1);
      const headText = trimmed.replace(/^#+\s+/, '');
      elements.push(
        <p key={`h-${i}`} className={cn('font-semibold text-foreground mt-2 mb-0.5', level === 1 ? 'text-[17px]' : level === 2 ? 'text-[15px]' : 'text-[14px] text-muted-foreground')}>
          {renderInline(headText)}
        </p>
      );
      i++; continue;
    }

    // Regular paragraph
    elements.push(
      <p key={`p-${i}`} className="text-[15px] leading-relaxed text-foreground/90">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <div className={cn('flex flex-col gap-0.5', className)}>{elements}</div>;
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfDay(d: Date) { const r = new Date(d); r.setHours(0,0,0,0); return r; }
function endOfDay(d: Date)   { const r = new Date(d); r.setHours(23,59,59,999); return r; }
function isoDate(d: Date)    { return d.toISOString().slice(0,10); }

function groupReportsByMonth(reports: ReportSummary[]): Array<{ label: string; reports: ReportSummary[] }> {
  const map: Record<string, ReportSummary[]> = {};
  const sorted = [...reports].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  for (const r of sorted) {
    const raw = new Date(r.created_at).toLocaleDateString('uk-UA', { month: 'long', year: 'numeric' });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);
    (map[label] ??= []).push(r);
  }
  return Object.entries(map).map(([label, reports]) => ({ label, reports }));
}

// ── New Report Sheet ──────────────────────────────────────────────────────────

const PERIOD_OPTIONS = [
  { type: 'daily',    label: 'Сьогодні',       icon: 'today',          fn: () => { const n = new Date(); return { from: startOfDay(n), to: endOfDay(n) }; } },
  { type: 'yesterday',label: 'Вчора',           icon: 'history',        fn: () => { const n = new Date(); const y = new Date(n); y.setDate(n.getDate()-1); return { from: startOfDay(y), to: endOfDay(y) }; } },
  { type: 'weekly',   label: '7 днів',          icon: 'date_range',     fn: () => { const n = new Date(); const f = new Date(n); f.setDate(n.getDate()-6); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { type: 'monthly',  label: 'Місяць',          icon: 'calendar_month', fn: () => { const n = new Date(); const f = new Date(n); f.setDate(1); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { type: '3months',  label: '3 місяці',        icon: 'calendar_month', fn: () => { const n = new Date(); const f = new Date(n); f.setMonth(n.getMonth()-3); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { type: 'year',     label: 'Рік',             icon: 'event_note',     fn: () => { const n = new Date(); const f = new Date(n); f.setFullYear(n.getFullYear()-1); return { from: startOfDay(f), to: endOfDay(n) }; } },
  { type: 'ytd',      label: 'З початку року',  icon: 'start',          fn: () => { const n = new Date(); return { from: startOfDay(new Date(n.getFullYear(),0,1)), to: endOfDay(n) }; } },
  { type: 'all',      label: 'Весь час',        icon: 'all_inclusive',  fn: () => { return { from: new Date('2020-01-01'), to: endOfDay(new Date()) }; } },
  { type: 'custom',   label: 'Свій діапазон',   icon: 'tune',           fn: null },
] as const;

function NewReportSheet({ open, onClose, onGenerate, generating }: {
  open: boolean; onClose: () => void;
  onGenerate: (periodType: string, from?: Date, to?: Date) => void;
  generating: boolean;
}) {
  const [fromStr, setFromStr] = useState(isoDate(startOfDay(new Date())));
  const [toStr, setToStr] = useState(isoDate(new Date()));
  const [selected, setSelected] = useState<{ type: string; from: Date; to: Date } | null>(null);
  const customExpanded = selected?.type === 'custom';

  const handleSelectPreset = (opt: typeof PERIOD_OPTIONS[number]) => {
    if (opt.fn) {
      const r = opt.fn();
      setSelected({ type: opt.type, from: r.from, to: r.to });
    } else {
      const from = startOfDay(new Date(fromStr)), to = endOfDay(new Date(toStr));
      const valid = !isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to;
      setSelected(valid ? { type: 'custom', from, to } : { type: 'custom', from: startOfDay(new Date()), to: endOfDay(new Date()) });
    }
  };

  const handleFromChange = (val: string) => {
    setFromStr(val);
    if (selected?.type === 'custom') {
      const from = startOfDay(new Date(val)), to = endOfDay(new Date(toStr));
      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) setSelected({ type: 'custom', from, to });
    }
  };

  const handleToChange = (val: string) => {
    setToStr(val);
    if (selected?.type === 'custom') {
      const from = startOfDay(new Date(fromStr)), to = endOfDay(new Date(val));
      if (!isNaN(from.getTime()) && !isNaN(to.getTime()) && from <= to) setSelected({ type: 'custom', from, to });
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose}>
      <div className="px-4 pt-3 pb-2">
        <h3 className="text-[17px] font-semibold">Нова ретроспектива</h3>
        <p className="text-[13px] text-muted-foreground">Оберіть період для аналізу</p>
      </div>
      <div className="px-4">
        {PERIOD_OPTIONS.map((opt) => {
          const isSelected = selected?.type === opt.type;
          return (
            <button key={opt.type} onClick={() => handleSelectPreset(opt)} className="min-h-[44px] flex items-center gap-3 px-0 w-full">
              <Icon name={opt.icon} size={20} className="text-primary/60 shrink-0" />
              <span className="flex-1 text-left text-[15px]">{opt.label}</span>
              {isSelected ? <Icon name="check" size={18} className="text-primary shrink-0" /> : <Icon name="chevron_right" size={18} className="text-muted-foreground shrink-0" />}
            </button>
          );
        })}
      </div>
      <div className={cn('overflow-hidden transition-all duration-300', customExpanded ? 'max-h-40' : 'max-h-0')}>
        <div className="mx-4 h-px bg-border/40" />
        <div className="px-4 pt-3 pb-1 flex items-center gap-2">
          <input type="date" value={fromStr} onChange={e => handleFromChange(e.target.value)} className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <span className="text-muted-foreground">–</span>
          <input type="date" value={toStr} onChange={e => handleToChange(e.target.value)} className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
      </div>
      <div className="px-4 pt-3 pb-2">
        <Button
          className="w-full min-h-[44px]"
          disabled={!selected || generating}
          onClick={() => {
            if (selected && !generating) {
              onGenerate(selected.type, selected.from, selected.to);
              onClose();
            }
          }}
        >
          {generating ? (
            <span className="flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
              Генерується...
            </span>
          ) : 'Згенерувати ретроспективу'}
        </Button>
      </div>
    </BottomSheet>
  );
}

// ── Stats types ───────────────────────────────────────────────────────────────

interface EntryStats {
  totalEntries: number;
  daysActive: number;
  totalDays: number;
  categoryBreakdown: { name: string; count: number; pct: number }[];
  metricHighlights: { label: string; value: number; unit: string; icon: string }[];
  dailyVolume: { date: string; count: number }[];
  moodTrend: number[]; // -2..+2 per day
  topCategory: string;
  hourlyVolume: number[]; // 24 buckets
  weekdayVolume: number[]; // 7 buckets Mon-Sun
  currentStreak: number;
  longestStreak: number;
}

const MOOD_KW: Record<string, number> = {
  радіс: 2, щасл: 2, чудов: 2, добр: 1, спокій: 1, задоволен: 1, енергій: 1,
  сумн: -1, втомл: -1, погано: -2, жахл: -2, злий: -2, тривог: -2, стрес: -2, паршив: -2,
};
function scoreMoodText(t: string) {
  const l = t.toLowerCase();
  let s = 0;
  for (const [k, v] of Object.entries(MOOD_KW)) if (l.includes(k)) s += v;
  return Math.max(-2, Math.min(2, s));
}

const CAT_LABELS: Record<string, string> = {
  thoughts: 'Думки', ideas: 'Ідеї', feelings: 'Почуття', expenses: 'Витрати',
  calories: 'Калорії', workout: 'Тренування', goals: 'Цілі', sleep: 'Сон',
  health: "Здоров'я", dreams: 'Сни', books: 'Книги', work: 'Робота',
  relationships: 'Стосунки', travel: 'Подорожі', gratitude: 'Вдячність',
  music: 'Музика', social: 'Соціальне',
};

function computeStats(entries: Array<{ content: string; category: string; metadata: Record<string, unknown>; created_at: string }>, from: Date, to: Date): EntryStats {
  const totalDays = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000));

  // Daily volume
  const dayMap = new Map<string, number>();
  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    dayMap.set(d.toISOString().slice(0, 10), 0);
  }
  for (const e of entries) {
    const day = new Date(e.created_at).toISOString().slice(0, 10);
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1);
  }
  const dailyVolume = [...dayMap.entries()].map(([date, count]) => ({ date, count }));
  const daysActive = dailyVolume.filter(d => d.count > 0).length;

  // Category breakdown
  const catCount = new Map<string, number>();
  for (const e of entries) {
    const cats = e.category.split(',').map(c => c.trim()).filter(Boolean);
    for (const c of cats) catCount.set(c, (catCount.get(c) ?? 0) + 1);
  }
  const total = entries.length || 1;
  const categoryBreakdown = [...catCount.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, count]) => ({ name, count, pct: Math.round((count / total) * 100) }));
  const topCategory = categoryBreakdown[0]?.name ?? '';

  // Metric highlights
  const metricMap = new Map<string, { label: string; values: number[]; unit: string; icon: string; aggregate: string }>();
  for (const e of entries) {
    const metrics = e.metadata?.dashboard_metrics as Array<{ key: string; label: string; value: number; unit: string; icon?: string; aggregate?: string }> | undefined;
    if (!Array.isArray(metrics)) continue;
    for (const m of metrics) {
      if (!metricMap.has(m.key)) metricMap.set(m.key, { label: m.label, values: [], unit: m.unit, icon: m.icon ?? 'tag', aggregate: m.aggregate ?? 'sum' });
      metricMap.get(m.key)!.values.push(m.value);
    }
  }
  const metricHighlights = [...metricMap.entries()].slice(0, 4).map(([, m]) => {
    const val = m.aggregate === 'avg'
      ? m.values.reduce((a, b) => a + b, 0) / m.values.length
      : m.values.reduce((a, b) => a + b, 0);
    return { label: m.label, value: Math.round(val * 10) / 10, unit: m.unit, icon: m.icon };
  });

  // Mood trend (per day, feelings category)
  const moodByDay = new Map<string, number[]>();
  for (const e of entries) {
    if (!e.category.includes('feelings')) continue;
    const day = new Date(e.created_at).toISOString().slice(0, 10);
    if (!moodByDay.has(day)) moodByDay.set(day, []);
    moodByDay.get(day)!.push(scoreMoodText(e.content));
  }
  const moodTrend = dailyVolume.map(({ date }) => {
    const scores = moodByDay.get(date);
    if (!scores || scores.length === 0) return 0;
    return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  });

  // Hourly distribution
  const hourlyVolume = Array(24).fill(0);
  for (const e of entries) hourlyVolume[new Date(e.created_at).getHours()]++;

  // Weekday distribution (0=Mon..6=Sun)
  const weekdayVolume = Array(7).fill(0);
  for (const e of entries) {
    const d = new Date(e.created_at).getDay();
    weekdayVolume[(d + 6) % 7]++;
  }

  // Streak calculation
  const activeDaySet = new Set(dailyVolume.filter(d => d.count > 0).map(d => d.date));
  let currentStreak = 0, longestStreak = 0, streak = 0;
  const today = new Date().toISOString().slice(0, 10);
  for (const { date } of dailyVolume) {
    if (activeDaySet.has(date)) { streak++; longestStreak = Math.max(longestStreak, streak); }
    else streak = 0;
  }
  const reversedDays = [...dailyVolume].reverse();
  for (const { date } of reversedDays) {
    if (date > today) continue;
    if (activeDaySet.has(date)) currentStreak++;
    else break;
  }

  return { totalEntries: entries.length, daysActive, totalDays, categoryBreakdown, metricHighlights, dailyVolume, moodTrend, topCategory, hourlyVolume, weekdayVolume, currentStreak, longestStreak };
}

function StatCard({ title, children, accent = '#4797FF' }: { title: string; children: React.ReactNode; accent?: string }) {
  return (
    <div className="rounded-2xl px-4 py-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
      <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: accent }}>{title}</p>
      {children}
    </div>
  );
}

// Activity heatmap — daily entry count as colored squares
function ActivityHeatmap({ dailyVolume }: { dailyVolume: { date: string; count: number }[] }) {
  const max = Math.max(1, ...dailyVolume.map(d => d.count));
  const weeks: { date: string; count: number }[][] = [];
  let week: { date: string; count: number }[] = [];
  for (const d of dailyVolume) {
    week.push(d);
    if (week.length === 7) { weeks.push(week); week = []; }
  }
  if (week.length > 0) weeks.push(week);

  return (
    <StatCard title="Активність" accent="#34d399">
      <div className="flex gap-1 flex-wrap">
        {dailyVolume.map(({ date, count }) => {
          const intensity = count === 0 ? 0 : Math.max(0.15, count / max);
          return (
            <div
              key={date}
              className="rounded-sm"
              style={{ width: 10, height: 10, backgroundColor: count === 0 ? 'rgba(255,255,255,0.05)' : `rgba(52,211,153,${intensity})` }}
              title={`${date}: ${count}`}
            />
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-2">
        {dailyVolume.filter(d => d.count > 0).length} з {dailyVolume.length} днів активних
      </p>
    </StatCard>
  );
}

// Category breakdown — horizontal bars
function CategoryBreakdown({ breakdown }: { breakdown: { name: string; count: number; pct: number }[] }) {
  const COLORS = ['#4797FF', '#34d399', '#a78bfa', '#fbbf24', '#f87171', '#60a5fa'];
  return (
    <StatCard title="Категорії" accent="#a78bfa">
      <div className="flex flex-col gap-2">
        {breakdown.map(({ name, count, pct }, i) => (
          <div key={name}>
            <div className="flex items-center justify-between mb-0.5">
              <span className="text-[12px] text-foreground/80">{CAT_LABELS[name] ?? name}</span>
              <span className="text-[11px] text-muted-foreground">{count}</span>
            </div>
            <div className="h-1.5 w-full rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
            </div>
          </div>
        ))}
      </div>
    </StatCard>
  );
}

// Metric highlights — 2×2 grid of big numbers
function MetricHighlights({ metrics }: { metrics: { label: string; value: number; unit: string; icon: string }[] }) {
  if (metrics.length === 0) return null;
  const COLORS = ['#4797FF', '#34d399', '#fbbf24', '#f87171'];
  return (
    <StatCard title="Метрики" accent="#fbbf24">
      <div className="grid grid-cols-2 gap-2">
        {metrics.map((m, i) => (
          <div key={m.label} className="rounded-xl px-3 py-2.5" style={{ background: `${COLORS[i % COLORS.length]}12`, border: `1px solid ${COLORS[i % COLORS.length]}25` }}>
            <p className="text-[10px] text-muted-foreground mb-1 truncate">{m.label}</p>
            <div className="flex items-baseline gap-1">
              <span className="text-[20px] font-bold" style={{ color: COLORS[i % COLORS.length] }}>{m.value.toLocaleString()}</span>
              <span className="text-[11px] text-muted-foreground">{m.unit}</span>
            </div>
          </div>
        ))}
      </div>
    </StatCard>
  );
}

// Mood sparkline — bar chart of daily mood
function MoodSparkline({ moodTrend }: { moodTrend: number[]; dailyVolume: { date: string; count: number }[] }) {
  const hasData = moodTrend.some(v => v !== 0);
  if (!hasData) return null;
  const avg = moodTrend.filter(v => v !== 0).reduce((a, b) => a + b, 0) / (moodTrend.filter(v => v !== 0).length || 1);
  const label = avg > 0.5 ? 'Позитивний' : avg < -0.5 ? 'Негативний' : 'Нейтральний';
  const labelColor = avg > 0.5 ? '#34d399' : avg < -0.5 ? '#f87171' : '#fbbf24';

  return (
    <StatCard title="Настрій" accent={labelColor}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-[22px] font-bold" style={{ color: labelColor }}>{label}</span>
      </div>
      <div className="flex items-end gap-0.5" style={{ height: 40 }}>
        {moodTrend.map((v, i) => {
          const h = v === 0 ? 3 : Math.max(4, Math.abs(v) / 2 * 36);
          const color = v > 0 ? '#34d399' : v < 0 ? '#f87171' : 'rgba(255,255,255,0.1)';
          return <div key={i} className="flex-1 rounded-sm" style={{ height: h, backgroundColor: color }} />;
        })}
      </div>
      <p className="text-[11px] text-muted-foreground mt-1.5">Динаміка настрою за період</p>
    </StatCard>
  );
}

// Volume bar chart — entries per day
function VolumeChart({ dailyVolume }: { dailyVolume: { date: string; count: number }[] }) {
  const max = Math.max(1, ...dailyVolume.map(d => d.count));
  const totalEntries = dailyVolume.reduce((a, b) => a + b.count, 0);
  // Show only last 14 days if longer
  const slice = dailyVolume.length > 14 ? dailyVolume.slice(-14) : dailyVolume;

  return (
    <StatCard title="Записи по днях" accent="#60a5fa">
      <div className="flex items-end gap-0.5 mb-2" style={{ height: 48 }}>
        {slice.map(({ date, count }) => {
          const h = count === 0 ? 2 : Math.max(4, (count / max) * 44);
          return (
            <div key={date} className="flex-1 rounded-sm" style={{ height: h, backgroundColor: count === 0 ? 'rgba(255,255,255,0.06)' : `rgba(96,165,250,${0.3 + (count / max) * 0.7})` }} />
          );
        })}
      </div>
      <p className="text-[11px] text-muted-foreground">{totalEntries} записів за період</p>
    </StatCard>
  );
}

// Hourly activity chart — when are you most active?
function HourlyChart({ hourlyVolume }: { hourlyVolume: number[] }) {
  const max = Math.max(1, ...hourlyVolume);
  const peakHour = hourlyVolume.indexOf(max);
  const fmt = (h: number) => `${h.toString().padStart(2,'0')}:00`;
  const total = hourlyVolume.reduce((a,b) => a+b, 0);
  if (total === 0) return null;
  return (
    <StatCard title="Активність по годинах" accent="#f472b6">
      <div className="flex items-end gap-px mb-2" style={{ height: 44 }}>
        {hourlyVolume.map((v, h) => {
          const height = v === 0 ? 2 : Math.max(3, (v / max) * 40);
          const isPeak = h === peakHour;
          return (
            <div key={h} className="flex-1 rounded-sm transition-all"
              style={{ height, backgroundColor: isPeak ? '#f472b6' : v === 0 ? 'rgba(255,255,255,0.05)' : `rgba(244,114,182,${0.2 + (v/max)*0.5})` }} />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground/50 mb-1">
        <span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>23:00</span>
      </div>
      <p className="text-[11px] text-muted-foreground">Пік активності: <span className="text-foreground/80 font-medium">{fmt(peakHour)}</span></p>
    </StatCard>
  );
}

// Weekday pattern — which days are most active?
function WeekdayPattern({ weekdayVolume }: { weekdayVolume: number[] }) {
  const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд'];
  const max = Math.max(1, ...weekdayVolume);
  const total = weekdayVolume.reduce((a,b) => a+b, 0);
  if (total === 0) return null;
  const peakDay = weekdayVolume.indexOf(Math.max(...weekdayVolume));
  return (
    <StatCard title="Активність по днях тижня" accent="#34d399">
      <div className="flex gap-1.5 items-end mb-2" style={{ height: 52 }}>
        {weekdayVolume.map((v, i) => {
          const h = v === 0 ? 3 : Math.max(4, (v / max) * 48);
          const isWeekend = i >= 5;
          const isPeak = i === peakDay;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full rounded-md transition-all"
                style={{ height: h, backgroundColor: isPeak ? '#34d399' : isWeekend ? 'rgba(52,211,153,0.25)' : 'rgba(52,211,153,0.15)' }} />
            </div>
          );
        })}
      </div>
      <div className="flex gap-1.5">
        {DAYS.map((d, i) => (
          <div key={d} className="flex-1 text-center text-[10px]"
            style={{ color: i === peakDay ? '#34d399' : 'rgba(255,255,255,0.3)' }}>{d}</div>
        ))}
      </div>
    </StatCard>
  );
}

// Streak card
function StreakCard({ currentStreak, longestStreak, daysActive, totalDays }: { currentStreak: number; longestStreak: number; daysActive: number; totalDays: number }) {
  const consistency = totalDays > 0 ? Math.round((daysActive / totalDays) * 100) : 0;
  return (
    <StatCard title="Серія та постійність" accent="#fbbf24">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Поточна серія', value: currentStreak, unit: 'дн', color: '#fbbf24' },
          { label: 'Найдовша', value: longestStreak, unit: 'дн', color: '#fb923c' },
          { label: 'Постійність', value: consistency, unit: '%', color: '#34d399' },
        ].map(({ label, value, unit, color }) => (
          <div key={label} className="rounded-xl px-2.5 py-2.5 text-center" style={{ background: `${color}12`, border: `1px solid ${color}25` }}>
            <p className="text-[10px] text-muted-foreground mb-1 leading-tight">{label}</p>
            <div className="flex items-baseline justify-center gap-0.5">
              <span className="text-[20px] font-bold leading-none" style={{ color }}>{value}</span>
              <span className="text-[10px] text-muted-foreground">{unit}</span>
            </div>
          </div>
        ))}
      </div>
    </StatCard>
  );
}

// Overview stat row
function OverviewStats({ stats }: { stats: EntryStats }) {
  const items = [
    { label: 'Записів', value: stats.totalEntries, color: '#4797FF' },
    { label: 'Активних днів', value: stats.daysActive, color: '#34d399' },
    { label: 'Всього днів', value: stats.totalDays, color: '#a78bfa' },
  ];
  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map(({ label, value, color }) => (
        <div key={label} className="rounded-2xl px-3 py-3 text-center" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
          <p className="text-[22px] font-bold" style={{ color }}>{value}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  );
}

// ── Report Detail View ────────────────────────────────────────────────────────

function ReportDetail({ report, onClose, accessToken }: {
  report: ReportSummary;
  onClose: () => void;
  accessToken?: string | null;
}) {
  const { play } = useSound();
  const [stats, setStats] = useState<EntryStats | null>(null);

  const from = new Date(report.period_from).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
  const to   = new Date(report.period_to).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

  // Fetch entries for the report period to compute visual stats
  useEffect(() => {
    if (!accessToken) return;
    const params = new URLSearchParams({ limit: '500', from: report.period_from, to: report.period_to });
    fetch(`/api/entries?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(d => setStats(computeStats(d.entries ?? [], new Date(report.period_from), new Date(report.period_to))))
      .catch(() => {});
  }, [accessToken, report.period_from, report.period_to]);

  const hasRetroSections = !!(report.went_well || report.didnt_go_well || report.start_stop_continue || report.experiment || report.lesson);
  const filledSections = RETRO_SECTIONS.filter(s => !!report[s.key]);

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col" style={{ paddingBottom: 'calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px))' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-5 pb-3 border-b border-border/20">
        <button
          onClick={() => { play('SLIDE'); onClose(); }}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-muted/60 text-muted-foreground shrink-0"
        >
          <Icon name="arrow_back" size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-[17px] font-semibold truncate">{PERIOD_LABELS[report.period_type] ?? 'Ретроспектива'}</p>
          <p className="text-[12px] text-muted-foreground">{from} — {to}</p>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero summary block */}
        <div className="px-4 pt-5 pb-4">
          <div
            className="rounded-3xl px-5 py-5 relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(71,151,255,0.12) 0%, rgba(167,139,250,0.08) 100%)', border: '1px solid rgba(71,151,255,0.15)' }}
          >
            {/* Decorative glow */}
            <div className="absolute -top-8 -right-8 h-32 w-32 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, #4797FF 0%, transparent 70%)' }} />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-primary/70 mb-3">Підсумок</p>
            <MarkdownText text={report.summary} />
          </div>
        </div>

        {/* Stats visualizations */}
        {stats && (
          <div className="px-4 flex flex-col gap-3 pb-2">
            <OverviewStats stats={stats} />
            <StreakCard currentStreak={stats.currentStreak} longestStreak={stats.longestStreak} daysActive={stats.daysActive} totalDays={stats.totalDays} />
            <VolumeChart dailyVolume={stats.dailyVolume} />
            {stats.weekdayVolume.some(v => v > 0) && <WeekdayPattern weekdayVolume={stats.weekdayVolume} />}
            {stats.hourlyVolume.some(v => v > 0) && <HourlyChart hourlyVolume={stats.hourlyVolume} />}
            {stats.categoryBreakdown.length > 0 && <CategoryBreakdown breakdown={stats.categoryBreakdown} />}
            {stats.metricHighlights.length > 0 && <MetricHighlights metrics={stats.metricHighlights} />}
            {stats.moodTrend.some(v => v !== 0) && <MoodSparkline moodTrend={stats.moodTrend} dailyVolume={stats.dailyVolume} />}
            {stats.dailyVolume.length > 7 && <ActivityHeatmap dailyVolume={stats.dailyVolume} />}
          </div>
        )}

        {/* Retro sections */}
        {hasRetroSections && (
          <div className="px-4 flex flex-col gap-3 pb-4">
            {filledSections.map((s, idx) => {
              const text = report[s.key];
              if (!text) return null;
              return (
                <motion.div
                  key={s.key}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className="rounded-2xl px-4 py-4"
                  style={{ background: s.bg, border: `1px solid ${s.border}` }}
                >
                  {/* Section header — label only, no emoji */}
                  <div className="mb-3">
                    <p className="text-[11px] font-bold uppercase tracking-widest" style={{ color: s.accent }}>{s.label}</p>
                  </div>
                  <MarkdownText text={stripSectionHeader(text)} />
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Legacy insights fallback */}
        {!hasRetroSections && report.insights.length > 0 && (
          <div className="px-4 flex flex-col gap-2.5 pb-4">
            {report.insights.map((ins, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: i * 0.04 }}
                className="flex items-start gap-3 rounded-2xl px-4 py-3.5"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
              >
                <span className="text-xl leading-none shrink-0 mt-0.5">{ins.emoji}</span>
                <MarkdownText text={ins.text} className="flex-1" />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Report list card ──────────────────────────────────────────────────────────

function ReportRow({ report, onTap }: {
  report: ReportSummary;
  onTap: () => void;
}) {
  const { play } = useSound();

  const from = new Date(report.period_from).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
  const to   = new Date(report.period_to).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });

  return (
    <div
      className="flex items-center gap-3 px-4 py-4 cursor-pointer active:bg-muted/20 transition-colors"
      onClick={() => { play('OPEN'); onTap(); }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2 mb-0.5">
          <span className="text-[15px] font-semibold">{PERIOD_LABELS[report.period_type] ?? 'Ретроспектива'}</span>
          <span className="text-[12px] text-muted-foreground/60">{from} — {to}</span>
        </div>
        <p className="text-[13px] text-muted-foreground line-clamp-1 leading-snug">{report.summary.replace(/\*\*/g, '').replace(/\*/g, '')}</p>
      </div>
      <Icon name="chevron_right" size={16} className="text-muted-foreground/40 shrink-0" />
    </div>
  );
}

// ── Reports page ──────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const { accessToken } = useAuth();
  const [reports, setReports] = useState<ReportSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewReport, setShowNewReport] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ReportSummary | null>(null);
  const { play } = useSound();

  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallProps, _setPaywallProps] = useState<{ feature: string; current?: number; limit?: number; requiredTier: SubscriptionTier }>({ feature: 'ai_reports', requiredTier: 'stars_basic' });
  const { counts: _counts } = useUsageCounts(accessToken);

  // Use shared generation context — survives tab switches
  const { generating, pendingLabel, startGeneration, setOnComplete } = useReportGeneration();

  const fetchUserTier = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
    } catch { /* non-critical */ }
  }, [accessToken]);

  const loadReports = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/reports', { headers: { Authorization: `Bearer ${accessToken}` } });
      const d = await res.json();
      setReports(d.reports ?? []);
    } finally { setLoading(false); }
  }, [accessToken]);

  // Register reload callback with the context so it fires when generation completes
  useEffect(() => {
    setOnComplete(() => loadReports);
    return () => setOnComplete(null);
  }, [setOnComplete, loadReports]);

  useEffect(() => { loadReports(); fetchUserTier(); }, [loadReports, fetchUserTier]);

  const generateReport = (periodType: string, from?: Date, to?: Date) => {
    startGeneration(periodType, from, to);
  };

  const monthGroups = groupReportsByMonth(reports);

  // If a report is selected, show detail view
  if (selectedReport) {
    return (
      <ReportDetail
        report={selectedReport}
        onClose={() => setSelectedReport(null)}
        accessToken={accessToken}
      />
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-3 px-4 pt-5 pb-6"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold leading-tight">Інсайти</h1>
          <p className="text-[13px] text-muted-foreground">Ретроспектива та аналіз</p>
        </div>
        <button
          onClick={() => { if (generating) return; play('OPEN'); setShowNewReport(true); }}
          disabled={generating}
          className="flex h-[44px] w-[44px] items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm disabled:opacity-50 transition-opacity mt-1 shrink-0"
          aria-label="Нова ретроспектива"
        >
          {generating
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            : <Icon name="add" size={20} />}
        </button>
      </div>

      {/* Usage counter removed — visible only on plans/subscriptions page */}

      {/* Error banner — now shown as persistent toast in layout */}

      {/* In-progress skeleton row — always on top, shown immediately when generation starts */}
      <AnimatePresence>
        {generating && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            className="rounded-2xl bg-card/60 border border-primary/20 overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary shrink-0" />
                  <span className="text-[15px] font-semibold text-muted-foreground">{pendingLabel ?? 'Ретроспектива'}</span>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">Генерується</span>
                </div>
                <div className="h-2.5 w-3/4 rounded-full bg-muted/50 animate-pulse" />
                <div className="h-2 w-1/2 rounded-full bg-muted/30 animate-pulse mt-1.5" />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-2" role="status">
          <SkeletonReportCard />
          <SkeletonReportCard />
        </div>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && !generating && (
        <EmptyState
          icon="💡"
          title="Ще немає ретроспектив"
          subtitle="Проаналізуй свій прогрес за будь-який період"
          features={[
            { emoji: '✅', text: 'Що пройшло добре цього тижня' },
            { emoji: '❌', text: 'Що не вийшло і чому' },
            { emoji: '🔄', text: 'Почати / Зупинити / Продовжити' },
            { emoji: '🧪', text: 'Гіпотеза для наступного спринту' },
            { emoji: '💡', text: 'Найважливіший урок періоду' },
          ]}
          ctaLabel="Створити першу ретроспективу"
          onCta={() => { play('OPEN'); setShowNewReport(true); }}
        />
      )}

      {/* Month-grouped report list */}
      {!loading && monthGroups.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-4"
        >
          {monthGroups.map(({ label, reports: groupReports }, groupIdx) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: groupIdx * 0.06, ease: [0.22, 1, 0.36, 1] }}
              className="flex flex-col gap-0"
            >
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1 mb-1">{label}</p>
              <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden divide-y divide-border/20">
                {groupReports.map(r => (
                  <ReportRow
                    key={r.id}
                    report={r}
                    onTap={() => setSelectedReport(r)}
                  />
                ))}
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      <NewReportSheet
        open={showNewReport}
        onClose={() => { play('CLOSE'); setShowNewReport(false); }}
        onGenerate={(type, from, to) => generateReport(type, from, to)}
        generating={generating}
      />

      <PaywallModal open={paywallOpen} onClose={() => setPaywallOpen(false)} {...paywallProps} />
    </motion.div>
  );
}
