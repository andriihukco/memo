'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { Trash2, MessageCircle, Bot, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { LockButton } from '@/components/ui/lock-button';
import { EditDrawer, getCategoryLabel, getCategoryColor } from '@/components/ui/edit-drawer';

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
function formatDate(iso: string) {
  return new Date(iso).toLocaleString('uk-UA', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ── DeleteConfirmDialog ───────────────────────────────────────────────────────

function DeleteConfirmDialog({ count, onConfirm, onCancel }: { count: number; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center px-4 pb-8">
      <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
      <Card className="relative w-full max-w-sm p-5 shadow-2xl">
        <h2 className="mb-1 text-base font-semibold">Видалити записи?</h2>
        <p className="mb-5 text-sm text-muted-foreground">
          {count === 1 ? 'Цей запис буде назавжди видалено.' : `${count} записів буде назавжди видалено.`}
        </p>
        <div className="flex gap-3">
          <Button variant="outline" className="flex-1" onClick={onCancel}>Скасувати</Button>
          <Button variant="destructive" className="flex-1" onClick={onConfirm}>Видалити</Button>
        </div>
      </Card>
    </div>
  );
}

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
          className={cn('relative select-none', isSelected && 'border-destructive bg-destructive/5', Math.abs(offsetX) >= SWIPE_COMMIT && 'opacity-50')}
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
            <div className={cn('mb-2 flex flex-wrap items-center gap-1.5', isSelectMode && 'pl-7')}>
              {entry.category.split(',').map(c => c.trim()).filter(Boolean).map(cat => (
                <Badge key={cat} className={cn('border text-[10px] font-medium', getCategoryColor(cat))} variant="outline">
                  {getCategoryLabel(cat, entry.category_label)}
                </Badge>
              ))}
              <time className="ml-auto shrink-0 text-xs text-muted-foreground">{formatDate(entry.created_at)}</time>
            </div>
            <EntryContent content={entry.content} className={cn(isSelectMode && 'pl-7')} />
            {entry.bot_reply && (
              <div className="mt-3 flex items-start gap-2 rounded-lg bg-surface-elevated/80 border border-border/30 px-3 py-2.5">
                <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
                  <Bot size={10} className="text-primary" />
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{entry.bot_reply}</p>
              </div>
            )}
          </div>
        </Card>
      </div>
      {editOpen && <EditDrawer entry={entry} onSave={onUpdate} onClose={() => setEditOpen(false)} accessToken={accessToken} />}
    </>
  );
}

// ── Thread grouping ───────────────────────────────────────────────────────────

interface ThreadGroup { threadId: string; entries: Entry[]; }

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

// ── ThreadCard — Reddit-style ─────────────────────────────────────────────────

function ThreadCard({ group, isSelectMode, selectedIds, onLongPress, onToggleSelect, onUpdate, onDelete, accessToken }: {
  group: ThreadGroup; isSelectMode: boolean; selectedIds: Set<string>;
  onLongPress: (id: string) => void; onToggleSelect: (id: string) => void;
  onUpdate: (id: string, content: string, category: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  accessToken?: string | null;
}) {
  const [showAll, setShowAll] = useState(false);
  const PREVIEW = 3;
  const entries = group.entries;
  const visible = showAll ? entries : entries.slice(0, PREVIEW);
  const hidden = entries.length - PREVIEW;
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const prevShowAll = useRef(showAll);

  useEffect(() => {
    if (prevShowAll.current !== showAll && contentRef.current) {
      const el = contentRef.current;
      // Animate from current height to new height
      const from = el.scrollHeight;
      el.style.height = `${from}px`;
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          el.style.height = 'auto';
          const to = el.scrollHeight;
          el.style.height = `${from}px`;
          requestAnimationFrame(() => {
            el.style.transition = 'height 0.25s ease';
            el.style.height = `${to}px`;
            const cleanup = () => {
              el.style.height = 'auto';
              el.style.transition = '';
            };
            el.addEventListener('transitionend', cleanup, { once: true });
          });
        });
      });
    }
    prevShowAll.current = showAll;
  }, [showAll]);

  return (
    <>
      <Card className="overflow-hidden">
        {/* Thread header */}
        <button
          className="flex w-full items-center gap-2 border-b border-border/50 bg-surface-elevated/50 px-4 py-2.5 transition-colors active:bg-muted/20"
          onClick={() => entries.length > PREVIEW && setShowAll(v => !v)}
        >
          <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
            <MessageCircle size={11} className="text-primary" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">
            Розмова · {entries.length} повідомлень
          </span>
          <Badge className={cn('ml-auto border text-[10px]', getCategoryColor(entries[0]?.category ?? ''))} variant="outline">
            {getCategoryLabel(entries[0]?.category ?? '', entries[0]?.category_label)}
          </Badge>
          {entries.length > PREVIEW && (
            <ChevronDown
              size={14}
              className={cn('ml-1 shrink-0 text-muted-foreground transition-transform duration-200', showAll && 'rotate-180')}
            />
          )}
        </button>

        {/* Messages */}
        <div ref={contentRef} style={{ overflow: 'hidden' }}>
          <div className="divide-y">
            {visible.map((entry, i) => {
              const isUser = !entry.reply_to_entry_id || i === 0;
              const isSelected = selectedIds.has(entry.id);
              return (
                <div
                  key={entry.id}
                  className={cn(
                    'flex gap-3 px-4 py-3 cursor-pointer transition-colors active:bg-muted/30',
                    isSelected && 'bg-destructive/5',
                    !isUser && 'bg-muted/20',
                    isUser && !isSelectMode && 'hover:bg-muted/10',
                  )}
                  onClick={() => {
                    if (isSelectMode) { onToggleSelect(entry.id); return; }
                    if (isUser) setEditEntry(entry);
                  }}
                  onContextMenu={(e) => { e.preventDefault(); onLongPress(entry.id); }}
                >
                  {/* Avatar */}
                  <div className={cn(
                    'mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold',
                    isUser ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                  )}>
                    {isUser ? 'Я' : <Bot size={14} />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="mb-0.5 flex items-center gap-2">
                      <span className="text-xs font-medium">{isUser ? 'Ти' : 'Memo'}</span>
                      <time className="text-[10px] text-muted-foreground">{formatTime(entry.created_at)}</time>
                      {isSelectMode && (
                        <div className={cn('ml-auto flex h-4 w-4 items-center justify-center rounded-full border-2', isSelected ? 'border-destructive bg-destructive' : 'border-muted-foreground/30')}>
                          {isSelected && <svg width="8" height="8" viewBox="0 0 12 12" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="2 6 5 9 10 3" /></svg>}
                        </div>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed text-foreground">{entry.content}</p>
                    {isUser && entry.bot_reply && (
                      <div className="mt-1.5 flex items-start gap-2 rounded-lg bg-surface-elevated/80 border border-border/30 px-3 py-2">
                        <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/10">
                          <Bot size={10} className="text-primary" />
                        </div>
                        <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">{entry.bot_reply}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Show more / collapse */}
          {hidden > 0 && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full border-t border-border/50 py-2.5 text-xs font-medium text-primary hover:text-primary/80 hover:bg-primary/5 transition-all duration-200 active:bg-primary/10"
            >
              ↓ Ще {hidden} {hidden === 1 ? 'повідомлення' : 'повідомлень'}
            </button>
          )}
          {showAll && entries.length > PREVIEW && (
            <button
              onClick={() => setShowAll(false)}
              className="w-full border-t border-border/50 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-all duration-200"
            >
              ↑ Згорнути
            </button>
          )}
        </div>
      </Card>

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

// ── CategoryFilterBar — single select ────────────────────────────────────────

function CategoryFilterBar({ entries, selected, onChange }: {
  entries: Entry[];
  selected: string | null;
  onChange: (cat: string | null) => void;
}) {
  const cats = Array.from(new Map(entries.map((e) => [e.category, e.category_label])).entries());

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      <Button size="sm" variant={selected === null ? 'default' : 'secondary'} className="shrink-0 rounded-full" onClick={() => onChange(null)}>
        Всі
      </Button>
      {cats.map(([cat, label]) => (
        <Button key={cat} size="sm" variant={selected === cat ? 'default' : 'secondary'} className="shrink-0 rounded-full" onClick={() => onChange(selected === cat ? null : cat)}>
          {getCategoryLabel(cat, label ?? undefined)}
        </Button>
      ))}
    </div>
  );
}

// ── FeedPage ──────────────────────────────────────────────────────────────────

export default function FeedPage() {
  const { accessToken } = useAuth();
  const [allEntries, setAllEntries] = useState<Entry[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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
    setEntries(selectedCategory ? allEntries.filter(e => e.category === selectedCategory) : allEntries);
  }, [allEntries, selectedCategory]);

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

  return (
    <div className="flex flex-col gap-4 px-4 pt-5">
      <div className="flex items-center justify-between">
        {isSelectMode ? (
          <>
            <button onClick={toggleSelectAll} className="text-sm font-medium underline-offset-2 hover:underline">
              {allSelected ? 'Зняти все' : `${selectedIds.size} вибрано — Вибрати все`}
            </button>
            <Button size="sm" variant="outline" onClick={exitSelectMode}>Скасувати</Button>
          </>
        ) : (
          <div className="flex items-center gap-0">
            <h1 className="text-lg font-semibold">Стрічка</h1>
            <LockButton />
          </div>
        )}
      </div>

      {!isSelectMode && (
        <CategoryFilterBar entries={allEntries} selected={selectedCategory} onChange={setSelectedCategory} />
      )}

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
            {selectedCategory ? 'Немає записів у цій категорії.' : 'Записів ще немає. Надішли повідомлення боту, щоб почати.'}
          </p>
        </div>
      )}
      {status === 'ready' && entries.length > 0 && (
        <div className="flex flex-col gap-3 pb-4">
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
                onSwipeDelete={() => setPendingDeleteIds([item.id])}
                onUpdate={handleUpdate}
                accessToken={accessToken}
              />
            );
          })}
        </div>
      )}

      {isSelectMode && (
        <div className="fixed left-0 right-0 z-40 flex justify-center px-4 py-3" style={{ bottom: 'calc(var(--tab-bar-h, 60px) + var(--bottom-inset, 0px))' }}>
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
        <DeleteConfirmDialog count={pendingDeleteIds.length} onConfirm={isDeleting ? () => { } : confirmDelete} onCancel={() => setPendingDeleteIds(null)} />
      )}
    </div>
  );
}
