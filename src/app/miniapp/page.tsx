'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { ProgressBar } from '@/components/ui/progress-bar';
import { cn } from '@/lib/utils';
import { EditDrawer, getCategoryLabel, getCategoryColor } from '@/components/ui/edit-drawer';
import { useSound } from '@/lib/sound/use-sound';
import { SkeletonEntryCard } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { ErrorBanner } from '@/components/ui/error-banner';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { PaywallModal } from '@/components/ui/paywall-modal';
import { UsageCounterChip } from '@/components/ui/usage-counter-chip';
import { useUsageCounts } from '@/lib/hooks/use-usage-counts';
import type { SubscriptionTier } from '@/lib/stars/paywall';

interface Entry {
  id: string;
  content: string;
  category: string;
  category_label?: string;
  metadata: Record<string, unknown>;
  created_at: string;
  bot_reply?: string | null;
  thread_id?: string | null;
  reply_to_entry_id?: string | null;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', { hour: '2-digit', minute: '2-digit' });
}

// ── UserAvatar ────────────────────────────────────────────────────────────────

// ── EntryContent ──────────────────────────────────────────────────────────────

function EntryContent({ content, className }: { content: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const LIMIT = 180;
  const isLong = content.length > LIMIT;
  return (
    <div className={className}>
      <p className="text-[15px] leading-relaxed text-foreground/90">
        {isLong && !expanded ? content.slice(0, LIMIT) + '…' : content}
      </p>
      {isLong && (
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(v => !v); }}
          className="mt-2 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
        >
          {expanded ? 'Згорнути' : 'Показати більше'}
        </button>
      )}
    </div>
  );
}

// ── SwipeableCard — standalone entry ─────────────────────────────────────────

const SWIPE_THRESHOLD = 72;
const SWIPE_COMMIT = 200;

function SwipeableCard({ entry, isSelectMode, isSelected, onLongPress, onToggleSelect, onSwipeDelete, onUpdate, accessToken, userTier }: {
  entry: Entry; isSelectMode: boolean; isSelected: boolean;
  onLongPress: () => void; onToggleSelect: () => void; onSwipeDelete: () => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
  accessToken?: string | null;
  userTier?: string | null;
}) {
  const { play } = useSound();
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
    play('OPEN');
    setEditOpen(true);
  };

  const revealRatio = Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1);
  const entryType = (entry.metadata?.entry_type as string) ?? 'log';

  return (
    <>
      <div className="relative overflow-hidden rounded-xl">
        <div className="absolute inset-0 flex items-center justify-end rounded-xl bg-destructive pr-5" style={{ opacity: revealRatio }}>
          <div className="flex flex-col items-center gap-0.5">
            <Icon name="delete" size={20} className="text-destructive-foreground" />
            <span className="text-[10px] font-medium text-destructive-foreground">Видалити</span>
          </div>
        </div>
        <Card
          className={cn(
            'relative select-none bg-card/60 border-border/30',
            isSelected && 'border-destructive bg-destructive/5',
            Math.abs(offsetX) >= SWIPE_COMMIT && 'opacity-50',
          )}
          style={{ transform: `translateX(${offsetX}px)`, transition: dragging ? 'none' : 'transform 0.25s ease' }}
          onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
          onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onML}
          onContextMenu={onCM} onClick={onClick}
        >
          <div className="px-4 py-3.5">
            {isSelectMode && (
              <div className="absolute left-3 top-3 z-10">
                <div className={cn('flex h-5 w-5 items-center justify-center rounded-full border-2 transition-colors', isSelected ? 'border-destructive bg-destructive' : 'border-muted-foreground/30 bg-background')}>
                  {isSelected && <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>}
                </div>
              </div>
            )}
            <div className={cn('mb-1.5 flex flex-wrap items-center gap-1.5', isSelectMode && 'pl-7')}>
              {entryType === 'goal' && (
                <span className="rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] px-2 py-0.5">
                  Ціль
                </span>
              )}
              {entryType !== 'goal' && Array.isArray(entry.metadata?.dashboard_metrics) && (entry.metadata.dashboard_metrics as unknown[]).length > 0 && (
                <span className="rounded-full bg-primary/20 border border-primary/40 text-primary text-[10px] px-2 py-0.5">
                  Лог
                </span>
              )}
              {entry.category.split(',').map(c => c.trim()).filter(Boolean).map(cat => (
                <Badge key={cat} className={cn('border text-[10px] font-medium', getCategoryColor(cat))} variant="outline">
                  {getCategoryLabel(cat, entry.category_label)}
                </Badge>
              ))}
              <time className="ml-auto shrink-0 text-[10px] text-muted-foreground/60">{formatTime(entry.created_at)}</time>
            </div>
            <EntryContent content={entry.content} className={cn(isSelectMode && 'pl-7')} />
            {entryType === 'goal' && (() => {
              const goalMetric = (entry.metadata?.goal_metrics as Array<{target: number; unit: string; key: string}> | undefined)?.[0];
              if (!goalMetric) return null;
              if (userTier === 'free') {
                return (
                  <div className="mt-2 flex flex-col gap-1">
                    <div className="relative h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div className="absolute inset-0 backdrop-blur-sm bg-muted/60 rounded-full" />
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                      <Icon name="lock" size={10} />
                      <span>Доступно з Basic</span>
                    </div>
                  </div>
                );
              }
              const current = 0;
              const target = goalMetric.target;
              const unit = goalMetric.unit;
              const pct = target > 0 ? Math.min(Math.round((current / target) * 100), 100) : 0;
              const completed = pct >= 100;
              return (
                <div className="mt-2 flex flex-col gap-1">
                  <ProgressBar value={pct} completed={completed} />
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                    <span>{current} / {target} {unit} · {pct}%</span>
                    {completed && <Icon name="check_circle" size={14} className="text-green-400" />}
                  </div>
                </div>
              );
            })()}
            {entry.bot_reply && (
              <p className="mt-2 text-[12px] leading-relaxed text-muted-foreground/60 italic line-clamp-2">
                {entry.bot_reply}
              </p>
            )}
          </div>
        </Card>
      </div>
      {editOpen && <EditDrawer entry={entry} onSave={onUpdate} onClose={() => { play('CLOSE'); setEditOpen(false); }} accessToken={accessToken} />}
    </>
  );
}

// ── Thread grouping ───────────────────────────────────────────────────────────

interface ThreadGroup { threadId: string; entries: Entry[]; }

// ── Date grouping ─────────────────────────────────────────────────────────────

interface DateGroup {
  dateKey: string;    // "2025-07-14" (UTC+3 local date)
  dateLabel: string;  // "14 липня 2025" (uk-UA locale)
  items: (Entry | ThreadGroup)[];
}

const TZ_OFFSET_MS = 3 * 60 * 60 * 1000;

function groupByDate(items: (Entry | ThreadGroup)[]): DateGroup[] {
  const map = new Map<string, DateGroup>();
  const order: string[] = [];

  for (const item of items) {
    // Get the created_at from the item (Entry or ThreadGroup's first entry)
    const createdAt = 'threadId' in item ? item.entries[0]?.created_at : item.created_at;
    if (!createdAt) continue;

    const utc3Date = new Date(new Date(createdAt).getTime() + TZ_OFFSET_MS);
    const dateKey = utc3Date.toISOString().slice(0, 10); // "YYYY-MM-DD"
    const dateLabel = utc3Date.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });

    if (!map.has(dateKey)) {
      map.set(dateKey, { dateKey, dateLabel, items: [] });
      order.push(dateKey);
    }
    map.get(dateKey)!.items.push(item);
  }

  return order.map(k => map.get(k)!);
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

// ── ThreadCard — minimal iOS-style ───────────────────────────────────────────

function ThreadCard({ group, isSelectMode, selectedIds, onLongPress, onToggleSelect, onUpdate, onDelete, accessToken }: {
  group: ThreadGroup; isSelectMode: boolean; selectedIds: Set<string>;
  onLongPress: (id: string) => void; onToggleSelect: (id: string) => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  accessToken?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const PREVIEW = 2;
  const entries = group.entries;
  const visible = showAll ? entries : entries.slice(0, PREVIEW);
  const hidden = entries.length - PREVIEW;
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const { play } = useSound();

  // Category badges from first entry — split multi-category strings
  const firstEntry = entries[0];
  const firstCats = (firstEntry?.category ?? '').split(',').map(c => c.trim()).filter(Boolean);

  return (
    <>
      <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden">
        {/* Thread meta row */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <span className="text-[11px] text-muted-foreground/60">
            {entries.length} повідомлень
          </span>
          <span className="ml-auto flex gap-1 flex-wrap justify-end">
            {firstCats.map(cat => (
              <span key={cat} className={cn('rounded-full border px-2 py-0.5 text-[10px] font-medium', getCategoryColor(cat))}>
                {getCategoryLabel(cat, firstEntry?.category_label)}
              </span>
            ))}
          </span>
        </div>

        {/* Messages */}
        <div className="flex flex-col divide-y divide-border/20">
          {visible.map((entry) => {
            const isUser = !entry.reply_to_entry_id;
            const isSelected = selectedIds.has(entry.id);
            return (
              <div
                key={entry.id}
                className={cn(
                  'px-3 py-2.5 cursor-pointer transition-colors active:bg-muted/20',
                  isSelected && 'bg-destructive/5',
                  !isUser && 'bg-muted/10',
                )}
                onClick={() => {
                  if (isSelectMode) { onToggleSelect(entry.id); return; }
                  if (isUser) setEditEntry(entry);
                }}
                onContextMenu={(e) => { e.preventDefault(); onLongPress(entry.id); }}
              >
                <div className="flex items-start gap-2.5">
                  {/* Avatar dot */}
                  <div className={cn(
                    'mt-1 h-5 w-5 shrink-0 rounded-full flex items-center justify-center text-[9px] font-bold',
                    isUser ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    {isUser ? 'Я' : <Icon name="smart_toy" size={11} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-1.5 mb-0.5">
                      <span className="text-[11px] font-medium text-muted-foreground">{isUser ? 'Ти' : 'Memo'}</span>
                      <time className="text-[10px] text-muted-foreground/50">{formatTime(entry.created_at)}</time>
                    </div>
                    <p className="text-[14px] leading-snug text-foreground/90">{entry.content}</p>
                    {isUser && entry.bot_reply && (
                      <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground/70 line-clamp-1 italic">
                        {entry.bot_reply}
                      </p>
                    )}
                  </div>
                  {isSelectMode && (
                    <div className={cn('mt-1 h-4 w-4 shrink-0 rounded-full border-2', isSelected ? 'border-destructive bg-destructive' : 'border-muted-foreground/30')}>
                      {isSelected && <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Expand / collapse */}
        {hidden > 0 && !showAll && (
          <button
            onClick={() => { play('OPEN'); setShowAll(true); }}
            className="w-full py-2 text-[12px] text-primary/70 border-t border-border/20 active:bg-muted/10"
          >
            Ще {hidden} {hidden === 1 ? 'повідомлення' : 'повідомлень'} ↓
          </button>
        )}
        {showAll && entries.length > PREVIEW && (
          <button
            onClick={() => { play('CLOSE'); setShowAll(false); }}
            className="w-full py-2 text-[12px] text-muted-foreground border-t border-border/20 active:bg-muted/10"
          >
            Згорнути ↑
          </button>
        )}
      </div>

      {editEntry && (
        <EditDrawer
          entry={editEntry}
          onSave={onUpdate}
          onDelete={onDelete}
          onClose={() => setEditEntry(null)}
          accessToken={accessToken}
        />
      )}
    </>
  );
}

// ── SwipeableThreadCard — wraps ThreadCard with swipe-to-delete ──────────────

function SwipeableThreadCard({ group, isSelectMode, selectedIds, onLongPress, onToggleSelect, onUpdate, onDelete, accessToken }: {
  group: ThreadGroup; isSelectMode: boolean; selectedIds: Set<string>;
  onLongPress: (id: string) => void; onToggleSelect: (id: string) => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  accessToken?: string | null;
}) {
  const { play } = useSound();
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0), startY = useRef(0);
  const isScrolling = useRef<boolean | null>(null);
  const mouseDown = useRef(false);
  const [pendingDelete, setPendingDelete] = useState(false);

  const commit = () => {
    if (Math.abs(offsetX) >= SWIPE_COMMIT) {
      // delete all entries in the thread
      play('OPEN');
      setPendingDelete(true);
    } else if (Math.abs(offsetX) >= SWIPE_THRESHOLD) {
      setOffsetX(-SWIPE_THRESHOLD);
    } else {
      setOffsetX(0);
    }
    setDragging(false);
  };

  const onTS = (e: React.TouchEvent) => {
    if (isSelectMode) return;
    const t = e.touches[0]; startX.current = t.clientX; startY.current = t.clientY; isScrolling.current = null;
  };
  const onTM = (e: React.TouchEvent) => {
    const t = e.touches[0]; const dx = t.clientX - startX.current, dy = t.clientY - startY.current;
    if (isScrolling.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) isScrolling.current = Math.abs(dy) > Math.abs(dx);
    if (isScrolling.current || isSelectMode) return;
    if (dx < 0) { setDragging(true); setOffsetX(Math.max(dx, -SWIPE_COMMIT - 20)); }
    else if (offsetX < 0) { setDragging(true); setOffsetX(Math.min(dx + offsetX, 0)); }
  };
  const onTE = () => { if (isScrolling.current || isSelectMode) { setDragging(false); return; } commit(); };

  const onMD = (e: React.MouseEvent) => { if (isSelectMode || e.button !== 0) return; mouseDown.current = true; startX.current = e.clientX; startY.current = e.clientY; isScrolling.current = null; };
  const onMM = (e: React.MouseEvent) => {
    if (!mouseDown.current || isSelectMode) return;
    const dx = e.clientX - startX.current, dy = e.clientY - startY.current;
    if (isScrolling.current === null && (Math.abs(dx) > 5 || Math.abs(dy) > 5)) isScrolling.current = Math.abs(dy) > Math.abs(dx);
    if (isScrolling.current) return;
    if (dx < 0) { setDragging(true); setOffsetX(Math.max(dx, -SWIPE_COMMIT - 20)); }
  };
  const onMU = () => { if (!mouseDown.current) return; mouseDown.current = false; if (isScrolling.current || isSelectMode) { setOffsetX(0); setDragging(false); return; } commit(); };
  const onML = () => { if (!mouseDown.current) return; mouseDown.current = false; setOffsetX(0); setDragging(false); };

  const revealRatio = Math.min(Math.abs(offsetX) / SWIPE_THRESHOLD, 1);

  const handleConfirmDelete = async () => {
    setPendingDelete(false);
    // delete all entries in the thread
    for (const entry of group.entries) {
      await onDelete(entry.id);
    }
  };

  return (
    <>
      <div
        className="relative overflow-hidden rounded-2xl"
        onTouchStart={onTS} onTouchMove={onTM} onTouchEnd={onTE}
        onMouseDown={onMD} onMouseMove={onMM} onMouseUp={onMU} onMouseLeave={onML}
      >
        {/* Delete background */}
        <div className="absolute inset-0 flex items-center justify-end rounded-2xl bg-destructive pr-5" style={{ opacity: revealRatio }}>
          <div className="flex flex-col items-center gap-0.5">
            <Icon name="delete" size={20} className="text-destructive-foreground" />
            <span className="text-[10px] font-medium text-destructive-foreground">Видалити</span>
          </div>
        </div>
        {/* Card content shifted */}
        <div style={{ transform: `translateX(${offsetX}px)`, transition: dragging ? 'none' : 'transform 0.25s ease' }}>
          <ThreadCard
            group={group}
            isSelectMode={isSelectMode}
            selectedIds={selectedIds}
            onLongPress={onLongPress}
            onToggleSelect={onToggleSelect}
            onUpdate={onUpdate}
            onDelete={onDelete}
            accessToken={accessToken}
          />
        </div>
      </div>
      <ConfirmSheet
        open={pendingDelete}
        onClose={() => { play('CLOSE'); setPendingDelete(false); setOffsetX(0); }}
        onConfirm={handleConfirmDelete}
        title="Видалити тред?"
        subtitle={`Буде видалено ${group.entries.length} повідомлень. Цю дію не можна скасувати.`}
        confirmLabel="Видалити"
      />
    </>
  );
}

// ── CategoryFilterBar — single select ────────────────────────────────────────

function CategoryFilterBar({ entries, selected, onChange }: {
  entries: Entry[];
  selected: string | null;
  onChange: (cat: string | null) => void;
}) {
  const { play } = useSound();
  // Collect unique categories, splitting comma-separated values
  const catMap = new Map<string, string | undefined>();
  for (const e of entries) {
    e.category.split(',').map(c => c.trim()).filter(Boolean).forEach(cat => {
      if (!catMap.has(cat)) catMap.set(cat, e.category_label);
    });
  }
  const cats = [...catMap.entries()];

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <Button size="sm" variant={selected === null ? 'default' : 'secondary'} className="shrink-0 rounded-full" onClick={() => { play('SELECT'); onChange(null); }}>
        Всі
      </Button>
      {cats.map(([cat, label]) => (
        <Button key={cat} size="sm" variant={selected === cat ? 'default' : 'secondary'} className="shrink-0 rounded-full" onClick={() => { play('SELECT'); onChange(selected === cat ? null : cat); }}>
          {getCategoryLabel(cat, label ?? undefined)}
        </Button>
      ))}
    </div>
  );
}

// ── FeedPage ──────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { accessToken } = useAuth();
  const { play } = useSound();
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Cursor-based pagination state ──────────────────────────────────────────
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);

  // Sentinel ref for IntersectionObserver
  const sentinelRef = useRef<HTMLDivElement>(null);

  // ── Paywall state ──────────────────────────────────────────────────────────
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallProps, setPaywallProps] = useState<{
    feature: string;
    current?: number;
    limit?: number;
    requiredTier: SubscriptionTier;
  }>({ feature: 'entries', requiredTier: 'stars_basic' });

  // ── User tier ──────────────────────────────────────────────────────────────
  const [userTier, setUserTier] = useState<SubscriptionTier | null>(null);
  const [trialUsed, setTrialUsed] = useState(true); // default true = no trial shown until confirmed
  const [subscriptionEndsAt, setSubscriptionEndsAt] = useState<string | null>(null);

  const fetchUserTier = useCallback(async () => {
    if (!accessToken) return;
    try {
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) return;
      const { profile } = await res.json();
      setUserTier((profile?.subscription_tier as SubscriptionTier) ?? 'free');
      setTrialUsed(profile?.trial_used ?? true);
      setSubscriptionEndsAt(profile?.subscription_ends_at ?? null);
    } catch { /* non-critical */ }
  }, [accessToken]);

  // ── Usage counts ───────────────────────────────────────────────────────────
  const { counts: usageCounts } = useUsageCounts(accessToken);

  const fetchEntries = useCallback(async () => {
    if (!accessToken) return;
    setStatus('loading');
    setNextCursor(null);
    setHasMore(false);
    setLoadMoreError(false);
    try {
      const res = await fetch('/api/entries?limit=20', { headers: { Authorization: `Bearer ${accessToken}` } });
      if (res.status === 402) {
        // Limit exceeded — open paywall
        const data = await res.json().catch(() => ({}));
        setPaywallProps({
          feature: data.feature ?? 'entries',
          current: data.current,
          limit: data.limit,
          requiredTier: (data.required_tier as SubscriptionTier) ?? 'stars_basic',
        });
        setPaywallOpen(true);
        setStatus('ready');
        return;
      }
      if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error ?? `Request failed (${res.status})`); }
      const { entries: data, has_more, next_cursor } = await res.json();
      setAllEntries(data ?? []);
      setHasMore(has_more ?? false);
      setNextCursor(next_cursor ?? null);
      setStatus('ready');
    } catch (err) { setErrorMsg(err instanceof Error ? err.message : 'Failed'); setStatus('error'); }
  }, [accessToken]);

  // ── Load next page ─────────────────────────────────────────────────────────
  const fetchMoreEntries = useCallback(async () => {
    if (!accessToken || !nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    try {
      const params = new URLSearchParams({ limit: '20', before: nextCursor });
      const res = await fetch(`/api/entries?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const { entries: data, has_more, next_cursor } = await res.json();
      // Append new entries to the existing list
      setAllEntries(prev => [...prev, ...(data ?? [])]);
      setHasMore(has_more ?? false);
      setNextCursor(next_cursor ?? null);
    } catch {
      setLoadMoreError(true);
    } finally {
      setLoadingMore(false);
    }
  }, [accessToken, nextCursor, loadingMore]);

  // ── IntersectionObserver — trigger load more when sentinel is visible ──────
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loadingMore && !loadMoreError) {
          fetchMoreEntries();
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadingMore, loadMoreError, fetchMoreEntries]);

  useEffect(() => {
    setEntries(selectedCategory ? allEntries.filter(e => e.category === selectedCategory) : allEntries);
  }, [allEntries, selectedCategory]);

  useEffect(() => { fetchEntries(); fetchUserTier(); }, [fetchEntries, fetchUserTier]);

  const exitSelectMode = () => { play('TOGGLE_OFF'); setIsSelectMode(false); setSelectedIds(new Set()); };
  const handleLongPress = (id: string) => { play('TOGGLE_ON'); setIsSelectMode(true); setSelectedIds(new Set([id])); };
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); if (next.size === 0) setIsSelectMode(false); return next; });
  };

  const confirmDelete = async () => {
    if (!pendingDeleteIds || !accessToken) return;
    play('CAUTION');
    setIsDeleting(true);
    try {
      const res = await fetch('/api/entries', { method: 'DELETE', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ ids: pendingDeleteIds }) });
      if (!res.ok) throw new Error('Delete failed');
      setAllEntries((prev) => prev.filter((e) => !pendingDeleteIds.includes(e.id)));
      exitSelectMode();
    } catch { /* keep */ } finally { setIsDeleting(false); setPendingDeleteIds(null); }
  };

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

  const handleDeleteSingle = async (id: string) => {
    if (!accessToken) return;
    const res = await fetch('/api/entries', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ ids: [id] }),
    });
    if (!res.ok) throw new Error('Delete failed');
    setAllEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const allIds = entries.map((e) => e.id);
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id));
  const toggleSelectAll = () => { if (allSelected) exitSelectMode(); else { setIsSelectMode(true); setSelectedIds(new Set(allIds)); } };

  // ── Trial detection ────────────────────────────────────────────────────────
  // A user is on a trial when: trial_used=true AND tier=stars_basic AND ends_at is in the future
  const isTrial = trialUsed && userTier === 'stars_basic' && !!subscriptionEndsAt && new Date(subscriptionEndsAt) > new Date();
  const trialDaysLeft = isTrial
    ? Math.max(1, Math.ceil((new Date(subscriptionEndsAt!).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4 px-4 pt-5"
    >
      {isSelectMode ? (
        <div className="flex items-center justify-between">
          <button onClick={toggleSelectAll} className="text-sm font-medium underline-offset-2 hover:underline">
            {allSelected ? 'Зняти все' : `${selectedIds.size} вибрано — Вибрати все`}
          </button>
          <Button size="sm" variant="outline" className="min-h-[44px]" onClick={exitSelectMode}>Скасувати</Button>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="text-[28px] font-bold leading-tight">Стрічка</h1>
            {/* Trial badge — shown when user is on an active free trial */}
            {isTrial && (
              <Badge className="shrink-0 rounded-full bg-amber-400/20 text-amber-400 border border-amber-400/30 text-[11px] font-semibold px-2.5 py-0.5">
                Пробний · {trialDaysLeft} дн.
              </Badge>
            )}
          </div>
          {/* Usage counter chip — shown when Free tier and usage ≥ 70 (70% of 100) */}
          {userTier === 'free' && usageCounts !== null && usageCounts.entries >= 70 && (
            <UsageCounterChip
              label={`${usageCounts.entries} / 100 записів`}
              onClick={() => {
                setPaywallProps({
                  feature: 'entries',
                  current: usageCounts.entries,
                  limit: 100,
                  requiredTier: 'stars_basic',
                });
                setPaywallOpen(true);
              }}
            />
          )}
        </div>
      )}

      {!isSelectMode && (
        <CategoryFilterBar entries={allEntries} selected={selectedCategory} onChange={setSelectedCategory} />
      )}

      {status === 'error' && (
        <ErrorBanner
          message={errorMsg || 'Не вдалося завантажити записи'}
          onRetry={() => { play('BUTTON'); fetchEntries(); }}
          onDismiss={() => setStatus('ready')}
        />
      )}

      {status === 'loading' && (
        <div className="flex flex-col gap-3" role="status" aria-label="Завантаження...">
          <SkeletonEntryCard />
          <SkeletonEntryCard />
          <SkeletonEntryCard />
          <SkeletonEntryCard />
        </div>
      )}
      {status === 'ready' && entries.length === 0 && (
        selectedCategory ? (
          <EmptyState
            icon="filter_list"
            title="Немає записів у цій категорії"
            subtitle="Спробуй іншу категорію або зніми фільтр"
            ctaLabel="Зняти фільтр"
            onCta={() => setSelectedCategory(null)}
          />
        ) : (
          <EmptyState
            icon="📓"
            title="Стрічка порожня"
            subtitle="Надішли перше повідомлення боту, щоб почати"
            features={[
              { emoji: '💬', text: 'Записуй думки, ідеї та події' },
              { emoji: '🤖', text: 'AI автоматично категоризує записи' },
              { emoji: '🔍', text: 'Фільтруй за категоріями' },
              { emoji: '✏️', text: 'Редагуй та видаляй свайпом' },
              { emoji: '🧵', text: 'Діалоги з ботом зберігаються як треди' },
            ]}
          />
        )
      )}
      {status === 'ready' && entries.length > 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
          className="flex flex-col gap-3 pb-4"
        >
          {groupByDate(groupByThread(entries)).map((group, groupIdx) => (
            <motion.div
              key={group.dateKey}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: groupIdx * 0.05, ease: [0.22, 1, 0.36, 1] }}
            >
              {/* Date header */}
              <div className="mb-2 px-1">
                <span className="text-[11px] font-medium text-muted-foreground/50 uppercase tracking-widest">
                  {group.dateLabel}
                </span>
              </div>

              {/* Entries */}
              <div className="flex flex-col gap-3">
                {group.items.map((item) => {
                  if ('threadId' in item) {
                    return (
                      <SwipeableThreadCard
                        key={item.threadId}
                        group={item}
                        isSelectMode={isSelectMode}
                        selectedIds={selectedIds}
                        onLongPress={handleLongPress}
                        onToggleSelect={handleToggleSelect}
                        onUpdate={handleUpdate}
                        onDelete={handleDeleteSingle}
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
                      onSwipeDelete={() => { play('OPEN'); setPendingDeleteIds([item.id]); }}
                      onUpdate={handleUpdate}
                      accessToken={accessToken}
                      userTier={userTier}
                    />
                  );
                })}
              </div>
            </motion.div>
          ))}

          {/* Sentinel div for IntersectionObserver — triggers next page load */}
          <div ref={sentinelRef} className="h-1" aria-hidden="true" />

          {/* Loading spinner — shown while fetching next page */}
          {loadingMore && (
            <div className="flex justify-center py-4" aria-label="Завантаження...">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
            </div>
          )}

          {/* Retry button — shown when next-page fetch failed */}
          {loadMoreError && !loadingMore && (
            <div className="flex flex-col items-center gap-2 py-4">
              <p className="text-[13px] text-muted-foreground">Не вдалося завантажити більше записів</p>
              <Button
                size="sm"
                variant="outline"
                className="rounded-full min-h-[36px]"
                onClick={() => { setLoadMoreError(false); fetchMoreEntries(); }}
              >
                Спробувати ще раз
              </Button>
            </div>
          )}
        </motion.div>
      )}

      {isSelectMode && (
        <div className="fixed left-0 right-0 z-40 flex justify-center px-4 py-3" style={{ bottom: 'calc(var(--tab-bar-h, 60px) + var(--bottom-inset, 0px))' }}>
          <button
            disabled={selectedIds.size === 0}
            onClick={() => { play('OPEN'); setPendingDeleteIds([...selectedIds]); }}
            className="flex items-center gap-2 rounded-full bg-destructive px-5 py-2.5 text-sm font-semibold text-destructive-foreground shadow-lg disabled:opacity-40 min-h-[44px]"
          >
            <Icon name="delete" size={15} />
            Видалити {selectedIds.size > 0 ? `(${selectedIds.size})` : ''}
          </button>
        </div>
      )}

      <ConfirmSheet
        open={!!pendingDeleteIds}
        onClose={() => { play('CLOSE'); setPendingDeleteIds(null); }}
        onConfirm={isDeleting ? () => {} : confirmDelete}
        title="Видалити запис?"
        subtitle="Цю дію не можна скасувати."
        confirmLabel="Видалити"
      />

      {/* Paywall Modal */}
      <PaywallModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        {...paywallProps}
        trialUsed={trialUsed}
        onTrialActivated={() => {
          setPaywallOpen(false);
          fetchUserTier(); // refresh tier + trial state
        }}
      />
    </motion.div>
  );
}
