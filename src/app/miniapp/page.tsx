'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { Trash2, MessageCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LockButton } from '@/components/ui/lock-button';
import { EditDrawer, getCategoryLabel, getCategoryColor } from '@/components/ui/edit-drawer';

type Category = string;

interface Entry {
  id: string;
  content: string;
  category: Category;
  category_label?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  bot_reply?: string | null;
  thread_id?: string | null;
  reply_to_entry_id?: string | null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function summarizeMetrics(metadata: Record<string, unknown>): string {
  const metrics = metadata.dashboard_metrics as Array<{ label: string; value: number; unit: string }> | undefined;
  if (!Array.isArray(metrics) || metrics.length === 0) return '';
  return '📊 ' + metrics.slice(0, 4).map(m => `${m.label}: ${m.value}${m.unit}`).join(' · ');
}

// ── Feed date filter ──────────────────────────────────────────────────────────

type FeedDateRange = 'all' | 'today' | 'week' | '2weeks' | 'month' | 'quarter' | '6months' | 'year' | 'custom';

const FEED_RANGE_LABELS: Record<FeedDateRange, string> = {
  all: 'Всі', today: 'Сьогодні', week: '7 днів', '2weeks': '2 тижні', month: '30 днів',
  quarter: 'Квартал', '6months': '6 міс', year: 'Рік', custom: 'Свій',
};

function feedRangeFor(r: FeedDateRange): { from: Date | null; to: Date | null } {
  if (r === 'all') return { from: null, to: null };
  const now = new Date();
  const ago = (days: number) => { const f = new Date(now); f.setDate(now.getDate()-days); f.setHours(0,0,0,0); return f; };
  const end = new Date(now); end.setHours(23,59,59,999);
  if (r === 'today')   return { from: ago(0), to: end };
  if (r === 'week')    return { from: ago(6), to: end };
  if (r === '2weeks')  return { from: ago(13), to: end };
  if (r === 'month')   return { from: ago(29), to: end };
  if (r === 'quarter') return { from: ago(89), to: end };
  if (r === '6months') return { from: ago(179), to: end };
  if (r === 'year')    return { from: ago(364), to: end };
  return { from: null, to: null };
}

function FeedCalendarSheet({ range, onApply, onClose }: {
  range: FeedDateRange;
  onApply: (r: FeedDateRange, from?: Date, to?: Date) => void;
  onClose: () => void;
}) {
  const [fromStr, setFromStr] = useState('');
  const [toStr, setToStr] = useState('');
  const PRESETS: FeedDateRange[] = ['all','today','week','2weeks','month','quarter','6months','year'];

  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full rounded-t-2xl bg-background px-4 pt-4 shadow-2xl"
        style={{ paddingBottom: 'calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px) + 0.5rem)' }}>
        <div className="mb-4 flex justify-center"><div className="h-1 w-10 rounded-full bg-muted" /></div>
        <h3 className="mb-3 text-sm font-semibold">Фільтр за датою</h3>
        <div className="mb-4 grid grid-cols-2 gap-2">
          {PRESETS.map(r => (
            <button key={r} onClick={() => { onApply(r); onClose(); }}
              className={cn('rounded-xl border py-2.5 text-sm font-medium transition-colors',
                range === r ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted/30 text-foreground')}>
              {FEED_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
        <p className="mb-2 text-xs text-muted-foreground">Або вкажи свій діапазон:</p>
        <div className="mb-3 flex items-center gap-2">
          <input type="date" value={fromStr} onChange={e => setFromStr(e.target.value)}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
          <span className="text-muted-foreground">–</span>
          <input type="date" value={toStr} onChange={e => setToStr(e.target.value)}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring" />
        </div>
        <Button className="w-full rounded-full" onClick={() => {
          if (fromStr && toStr) {
            const f = new Date(fromStr); f.setHours(0,0,0,0);
            const t = new Date(toStr); t.setHours(23,59,59,999);
            if (!isNaN(f.getTime()) && !isNaN(t.getTime()) && f <= t) { onApply('custom', f, t); onClose(); }
          }
        }}>Застосувати</Button>
      </div>
    </div>
  );
}

// ── DeleteConfirmDialog ───────────────────────────────────────────────────────

function DeleteConfirmDialog({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-8">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <Card className="relative w-full max-w-sm p-5 shadow-2xl">
        <h2 className="mb-1 text-base font-semibold">Видалити записи?</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {count === 1 ? 'Цей запис буде назавжди видалено. Відновити неможливо.' : `${count} записів буде назавжди видалено. Відновити неможливо.`}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1 rounded-full" onClick={onCancel}>Скасувати</Button>
          <Button variant="destructive" className="flex-1 rounded-full" onClick={onConfirm}>Видалити</Button>
        </div>
      </Card>
    </div>
  );
}

// ── EntryContent — truncated with show more ───────────────────────────────────

function EntryContent({ content, className }: { content: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 160;
  const isLong = content.length > LIMIT;
  return (
    <div className={className}>
      <p className="text-sm leading-relaxed">
        {isLong && !expanded ? content.slice(0, LIMIT) + '…' : content}
      </p>
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="mt-1 text-xs text-primary/70 hover:text-primary"
        >
          {expanded ? 'Згорнути' : 'Показати більше'}
        </button>
      )}
    </div>
  );
}

// ── CategoryChips — skip duplicates vs previous entry ────────────────────────

function CategoryChips({ category, categoryLabel, prevCategory, className }: {
  category: string; categoryLabel?: string; prevCategory?: string; className?: string;
}) {
  const cats = category.split(',').map(c => c.trim()).filter(Boolean);
  const prev = prevCategory ? prevCategory.split(',').map(c => c.trim()).filter(Boolean) : [];
  const newCats = cats.filter(c => !prev.includes(c));
  if (newCats.length === 0) return null;
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {newCats.map(cat => (
        <Badge key={cat} className={cn('border text-[10px] font-medium', getCategoryColor(cat))} variant="outline">
          {getCategoryLabel(cat, categoryLabel)}
        </Badge>
      ))}
    </div>
  );
}

// ── BotReplyBubble ────────────────────────────────────────────────────────────

function BotReplyBubble({ text, metrics }: { text: string; metrics?: string }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 120;
  const isLong = text.length > LIMIT;
  return (
    <div className="ml-4 mt-1 flex items-start gap-2">
      <div className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15">
        <MessageCircle size={9} className="text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-xs leading-relaxed text-muted-foreground">
          {isLong && !expanded ? text.slice(0, LIMIT) + '…' : text}
        </p>
        {isLong && (
          <button onClick={() => setExpanded(v => !v)} className="mt-0.5 text-[10px] text-primary/60 hover:text-primary">
            {expanded ? 'Згорнути' : 'Більше'}
          </button>
        )}
        {metrics && <p className="mt-0.5 text-[10px] text-muted-foreground/50">{metrics}</p>}
      </div>
    </div>
  );
}

// ── SwipeableCard ─────────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 72;
const SWIPE_COMMIT = 200;

function SwipeableCard({ entry, isSelectMode, isSelected, onLongPress, onToggleSelect, onSwipeDelete, onUpdate, accessToken }: {
  entry: Entry; isSelectMode: boolean; isSelected: boolean;
  onLongPress: () => void; onToggleSelect: () => void; onSwipeDelete: () => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
  accessToken?: string | null;
}) {
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0), startY = useRef(0);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const didLongPress = useRef(false);
  const isScrolling = useRef<boolean | null>(null);
  const mouseDown = useRef(false);
  const [editOpen, setEditOpen] = useState(false);

  const clearLP = () => { if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; } };
  const startLP = () => { didLongPress.current = false; longPressTimer.current = setTimeout(() => { didLongPress.current = true; onLongPress(); }, 500); };
  const commit = () => {
    if (Math.abs(offsetX) >= SWIPE_COMMIT) onSwipeDelete();
    else if (Math.abs(offsetX) >= SWIPE_THRESHOLD) setOffsetX(-SWIPE_THRESHOLD);
    else setOffsetX(0);
    setDragging(false);
  };

  const onTS = (e: React.TouchEvent) => { if (isSelectMode) return; const t = e.touches[0]; startX.current = t.clientX; startY.current = t.clientY; isScrolling.current = null; startLP(); };
  const onTM = (e: React.TouchEvent) => { clearLP(); const t = e.touches[0]; const dx = t.clientX - startX.current, dy = t.clientY - startY.current; if (isScrolling.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) isScrolling.current = Math.abs(dy) > Math.abs(dx); if (isScrolling.current || isSelectMode) return; if (dx < 0) { setDragging(true); setOffsetX(Math.max(dx, -SWIPE_COMMIT - 20)); } };
  const onTE = () => { clearLP(); if (isScrolling.current || isSelectMode) { setOffsetX(0); setDragging(false); return; } commit(); };
  const onMD = (e: React.MouseEvent) => { if (isSelectMode || e.button !== 0) return; mouseDown.current = true; startX.current = e.clientX; startY.current = e.clientY; isScrolling.current = null; startLP(); };
  const onMM = (e: React.MouseEvent) => { if (!mouseDown.current || isSelectMode) return; clearLP(); const dx = e.clientX - startX.current, dy = e.clientY - startY.current; if (isScrolling.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) isScrolling.current = Math.abs(dy) > Math.abs(dx); if (isScrolling.current) return; if (dx < 0) { setDragging(true); setOffsetX(Math.max(dx, -SWIPE_COMMIT - 20)); } };
  const onMU = () => { if (!mouseDown.current) return; mouseDown.current = false; clearLP(); if (isScrolling.current || isSelectMode) { setOffsetX(0); setDragging(false); return; } commit(); };
  const onML = () => { if (!mouseDown.current) return; mouseDown.current = false; clearLP(); setOffsetX(0); setDragging(false); };
  const onCM = (e: React.MouseEvent) => { if (!isSelectMode) e.preventDefault(); };
  const onClick = () => {
    if (didLongPress.current) return;
    if (isSelectMode) { onToggleSelect(); return; }
    if (offsetX !== 0) { setOffsetX(0); return; }
    setEditOpen(true);
  };

  const revealRatio = Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1);

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        <div className="absolute inset-0 flex items-center justify-end rounded-xl bg-destructive pr-5" style={{ opacity: revealRatio }}>
          <div className="flex flex-col items-center gap-0.5">
            <Trash2 size={20} className="text-destructive-foreground" />
            <span className="text-[10px] font-medium text-destructive-foreground">Видалити</span>
          </div>
        </div>
        <Card
          className={cn('relative select-none transition-colors', isSelected && 'border-destructive bg-destructive/5', Math.abs(offsetX) >= SWIPE_COMMIT && 'opacity-50')}
          style={{ transform: `translateX(${offsetX}px)`, transition: dragging ? 'none' : 'transform 0.25s ease' }}
          onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onML}
          onContextMenu={onCM} onClick={onClick}
        >
          <div className="p-4">
            {isSelectMode && (
              <div className="absolute left-3 top-3 z-10">
                <div className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors', isSelected ? 'border-destructive bg-destructive' : 'border-muted-foreground/30 bg-background')}>
                  {isSelected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>}
                </div>
              </div>
            )}
            <div className={cn('mb-2 flex flex-wrap items-start gap-1.5', isSelectMode && 'pl-7')}>
              {entry.category.split(',').map(c => c.trim()).filter(Boolean).map(cat => (
                <Badge key={cat} className={cn('border font-medium', getCategoryColor(cat))} variant="outline">
                  {getCategoryLabel(cat, entry.category_label)}
                </Badge>
              ))}
              <time className="ml-auto shrink-0 text-xs text-muted-foreground">{formatDate(entry.created_at)}</time>
            </div>
            <EntryContent content={entry.content} className={cn(isSelectMode && 'pl-7')} />
          </div>
        </Card>
      </div>
      {editOpen && <EditDrawer entry={entry} onSave={onUpdate} onClose={() => setEditOpen(false)} accessToken={accessToken} />}
    </>
  );
}

// ── Thread grouping ───────────────────────────────────────────────────────────

interface ThreadGroup {
  threadId: string;
  entries: Entry[];
}

function groupByThread(entries: Entry[]): (Entry | ThreadGroup)[] {
  const threadMap = new Map<string, Entry[]>();
  const result: (Entry | ThreadGroup)[] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (entry.thread_id) {
      if (!threadMap.has(entry.thread_id)) threadMap.set(entry.thread_id, []);
      threadMap.get(entry.thread_id)!.push(entry);
    }
  }

  for (const entry of entries) {
    if (seen.has(entry.id)) continue;
    if (entry.thread_id && threadMap.has(entry.thread_id)) {
      const group = threadMap.get(entry.thread_id)!;
      group.forEach((e) => seen.add(e.id));
      result.push({ threadId: entry.thread_id, entries: [...group].reverse() });
      threadMap.delete(entry.thread_id);
    } else {
      seen.add(entry.id);
      result.push(entry);
    }
  }
  return result;
}

// ── ThreadEntry — single entry in a thread ────────────────────────────────────

function ThreadEntry({ entry, prevEntry, depth, isSelectMode, isSelected, onLongPress, onToggleSelect, onUpdate, accessToken }: {
  entry: Entry; prevEntry?: Entry; depth: number;
  isSelectMode: boolean; isSelected: boolean;
  onLongPress: () => void; onToggleSelect: () => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
  accessToken?: string | null;
}) {
  const [editOpen, setEditOpen] = useState(false);
  return (
    <>
      <div className={cn('relative', depth > 0 && 'ml-4 border-l-2 border-muted pl-3')}>
        <CategoryChips
          category={entry.category}
          categoryLabel={entry.category_label}
          prevCategory={prevEntry?.category}
          className="mb-1"
        />
        <div
          className={cn(
            'rounded-xl bg-card px-3 py-2.5 shadow-sm cursor-pointer select-none transition-colors active:bg-muted/40',
            isSelected && 'ring-2 ring-destructive'
          )}
          onClick={() => { if (isSelectMode) { onToggleSelect(); return; } setEditOpen(true); }}
          onContextMenu={(e) => { e.preventDefault(); onLongPress(); }}
        >
          <EntryContent content={entry.content} />
          <div className="mt-1.5 flex items-center justify-between">
            <time className="text-[10px] text-muted-foreground/60">{formatDate(entry.created_at)}</time>
            {isSelectMode && (
              <div className={cn('flex h-4 w-4 items-center justify-center rounded-full border-2', isSelected ? 'border-destructive bg-destructive' : 'border-muted-foreground/30')}>
                {isSelected && <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>}
              </div>
            )}
          </div>
        </div>
        {entry.bot_reply && <BotReplyBubble text={entry.bot_reply} metrics={summarizeMetrics(entry.metadata)} />}
      </div>
      {editOpen && <EditDrawer entry={entry} onSave={onUpdate} onClose={() => setEditOpen(false)} accessToken={accessToken} />}
    </>
  );
}

// ── ThreadCard — Reddit-style nested thread ───────────────────────────────────

function ThreadCard({ group, isSelectMode, selectedIds, onLongPress, onToggleSelect, onUpdate, accessToken }: {
  group: ThreadGroup; isSelectMode: boolean; selectedIds: Set<string>;
  onLongPress: (id: string) => void; onToggleSelect: (id: string) => void;
  onSwipeDelete?: (id: string) => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
  accessToken?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const PREVIEW = 2;
  const entries = group.entries;
  const visible = showAll ? entries : entries.slice(0, PREVIEW);
  const hidden = entries.length - PREVIEW;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 px-0.5">
        <MessageCircle size={10} className="text-muted-foreground/50" />
        <span className="text-[10px] text-muted-foreground/50">Розмова · {entries.length}</span>
      </div>
      {visible.map((entry, i) => (
        <ThreadEntry
          key={entry.id}
          entry={entry}
          prevEntry={i > 0 ? entries[i - 1] : undefined}
          depth={i}
          isSelectMode={isSelectMode}
          isSelected={selectedIds.has(entry.id)}
          onLongPress={() => onLongPress(entry.id)}
          onToggleSelect={() => onToggleSelect(entry.id)}
          onUpdate={onUpdate}
          accessToken={accessToken}
        />
      ))}
      {hidden > 0 && !showAll && (
        <button onClick={() => setShowAll(true)} className="ml-4 self-start text-xs text-primary/70 hover:text-primary">
          ↓ Показати ще {hidden} {hidden === 1 ? 'повідомлення' : 'повідомлень'}
        </button>
      )}
      {showAll && entries.length > PREVIEW && (
        <button onClick={() => setShowAll(false)} className="ml-4 self-start text-xs text-muted-foreground hover:text-foreground">
          ↑ Згорнути
        </button>
      )}
    </div>
  );
}

// ── CategoryFilterBar ─────────────────────────────────────────────────────────

function CategoryFilterBar({ entries, selected, onChange }: {
  entries: Entry[];
  selected: Set<string>;
  onChange: (cats: Set<string>) => void;
}) {
  const cats = Array.from(new Map(entries.map((e) => [e.category, e.category_label])).entries());
  const allSelected = selected.size === 0;

  const toggle = (cat: string) => {
    const next = new Set(selected);
    if (next.has(cat)) next.delete(cat);
    else next.add(cat);
    onChange(next);
  };

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <Button size="sm" variant={allSelected ? 'default' : 'secondary'} className="shrink-0 rounded-full" onClick={() => onChange(new Set())}>
        Всі
      </Button>
      {cats.map(([cat, label]) => (
        <Button key={cat} size="sm" variant={selected.has(cat) ? 'default' : 'secondary'} className="shrink-0 rounded-full" onClick={() => toggle(cat)}>
          {getCategoryLabel(cat, label ?? undefined)}
        </Button>
      ))}
    </div>
  );
}

// ── FeedPage ──────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { accessToken } = useAuth();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [feedRange, setFeedRange] = useState<FeedDateRange>('all');
  const [feedCustomFrom, setFeedCustomFrom] = useState<Date | null>(null);
  const [feedCustomTo, setFeedCustomTo] = useState<Date | null>(null);
  const [showFeedCalendar, setShowFeedCalendar] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  const fetchEntries = useCallback(async () => {
    if (!accessToken) return;
    setStatus('loading');
    try {
      const res = await fetch('/api/entries?limit=100', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Request failed (${res.status})`); }
      const { entries: data } = await res.json();
      setAllEntries(data ?? []); setStatus('ready');
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Failed'); setStatus('error'); }
  }, [accessToken]);

  useEffect(() => {
    let filtered = allEntries;
    // Date filter
    const { from, to } = feedRange === 'custom'
      ? { from: feedCustomFrom, to: feedCustomTo }
      : feedRangeFor(feedRange);
    if (from) filtered = filtered.filter(e => new Date(e.created_at) >= from);
    if (to)   filtered = filtered.filter(e => new Date(e.created_at) <= to);
    // Category filter
    if (selectedCategories.size > 0) filtered = filtered.filter(e => selectedCategories.has(e.category));
    setEntries(filtered);
  }, [allEntries, selectedCategories, feedRange, feedCustomFrom, feedCustomTo]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const exitSelectMode = () => { setIsSelectMode(false); setSelectedIds(new Set()); };
  const handleLongPress = (id: string) => { setIsSelectMode(true); setSelectedIds(new Set([id])); };
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); if (next.size === 0) setIsSelectMode(false); return next; });
  };

  const confirmDelete = async () => {
    if (!pendingDeleteIds || !accessToken) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/entries', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ ids: pendingDeleteIds }) });
      if (!res.ok) throw new Error('Delete failed');
      setAllEntries((prev) => prev.filter((e) => !pendingDeleteIds.includes(e.id)));
      exitSelectMode();
    } catch { /* keep */ } finally { setIsDeleting(false); setPendingDeleteIds(null); }
  };

  const allIds = entries.map((e) => e.id);
  const handleUpdate = async (id: string, content: string, category: string) => {
    if (!accessToken) return;
    const res = await fetch('/api/entries', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ id, content, category }),
    });
    if (!res.ok) throw new Error('Update failed');
    const { entry: updated } = await res.json();
    setAllEntries((prev) => prev.map((e) => e.id === id ? { ...e, ...updated } : e));
  };

  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => { if (allSelected) exitSelectMode(); else { setIsSelectMode(true); setSelectedIds(new Set(allIds)); } };

  return (
    <div className="flex flex-col gap-4 px-4 pt-5">
      <div className="flex items-center justify-between">
        {isSelectMode ? (
          <>
            <button onClick={toggleSelectAll} className="text-sm font-medium text-foreground underline-offset-2 hover:underline">
              {allSelected ? 'Зняти все' : `${selectedIds.size} вибрано — Вибрати все`}
            </button>
            <Button size="sm" variant="outline" onClick={exitSelectMode}>Скасувати</Button>
          </>
        ) : (
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-0">
              <h1 className="text-lg font-semibold">Стрічка</h1>
              <LockButton />
            </div>
            <button
              onClick={() => setShowFeedCalendar(true)}
              className={cn('flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors',
                feedRange !== 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}
            >
              <Calendar size={12} />
              {feedRange === 'all' ? 'Всі' : feedRange === 'custom' && feedCustomFrom && feedCustomTo
                ? `${feedCustomFrom.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })} – ${feedCustomTo.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })}`
                : FEED_RANGE_LABELS[feedRange]}
            </button>
          </div>
        )}
      </div>

      {!isSelectMode && <CategoryFilterBar entries={allEntries} selected={selectedCategories} onChange={setSelectedCategories} />}

      {status === 'loading' && (
        <div className="flex flex-col items-center justify-center py-16">
          <div className="mb-3 h-7 w-7 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <p className="text-sm text-muted-foreground">Завантаження записів...</p>
        </div>
      )}
      {status === 'error' && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="mb-1 text-sm font-medium">Щось пішло не так</p>
          <p className="mb-4 text-xs text-muted-foreground">{errorMsg}</p>
          <Button size="sm" onClick={() => fetchEntries()}>Спробувати знову</Button>
        </div>
      )}
      {status === 'ready' && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {selectedCategories.size > 0 ? 'Немає записів у вибраних категоріях.' : 'Записів ще немає. Надішли повідомлення боту, щоб почати.'}
          </p>
        </div>
      )}
      {status === 'ready' && entries.length > 0 && (
        <div ref={listRef} className="flex flex-col gap-3 pb-4">
          {groupByThread(entries).map((item) => {
            if ('threadId' in item) {
              return (
                <ThreadCard
                  key={item.threadId}
                  group={item}
                  isSelectMode={isSelectMode}
                  selectedIds={selectedIds}
                  onLongPress={handleLongPress}
                  onToggleSelect={handleToggleSelect}
                  onSwipeDelete={(id) => setPendingDeleteIds([id])}
                  onUpdate={handleUpdate}
                  accessToken={accessToken}
                />
              );
            }
            return (
              <SwipeableCard
                key={item.id}
                entry={item}
                isSelectMode={isSelectMode}
                isSelected={selectedIds.has(item.id)}
                onLongPress={() => handleLongPress(item.id)}
                onToggleSelect={() => handleToggleSelect(item.id)}
                onSwipeDelete={() => setPendingDeleteIds([item.id])}
                onUpdate={handleUpdate}
                accessToken={accessToken}
              />
            );
          })}
        </div>
      )}

      {isSelectMode && (
        <div
          className="fixed left-0 right-0 z-40 flex justify-center px-4 py-3"
          style={{ bottom: 'calc(var(--tab-bar-h, 60px) + var(--bottom-inset, 0px))' }}
        >
          <button
            disabled={selectedIds.size === 0}
            onClick={() => setPendingDeleteIds([...selectedIds])}
            className="flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground shadow-lg disabled:opacity-40"
          >
            <Trash2 size={15} />
            Видалити {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
        </div>
      )}

      {pendingDeleteIds && (
        <DeleteConfirmDialog count={pendingDeleteIds.length} onConfirm={isDeleting ? () => {} : confirmDelete} onCancel={() => setPendingDeleteIds(null)} />
      )}

      {showFeedCalendar && (
        <FeedCalendarSheet
          range={feedRange}
          onApply={(r, from, to) => {
            setFeedRange(r);
            if (r === 'custom' && from && to) { setFeedCustomFrom(from); setFeedCustomTo(to); }
          }}
          onClose={() => setShowFeedCalendar(false)}
        />
      )}
    </div>
  );
}
