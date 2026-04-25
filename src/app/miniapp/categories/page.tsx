'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';
import { useSound } from '@/lib/sound/use-sound';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

// ── Default categories (always shown) ────────────────────────────────────────

const DEFAULT_CATEGORIES: { name: string; label_ua: string; emoji: string }[] = [
  { name: 'thoughts',      label_ua: 'Думки',       emoji: '💭' },
  { name: 'ideas',         label_ua: 'Ідеї',        emoji: '💡' },
  { name: 'feelings',      label_ua: 'Почуття',     emoji: '❤️' },
  { name: 'expenses',      label_ua: 'Витрати',     emoji: '💸' },
  { name: 'calories',      label_ua: 'Калорії',     emoji: '🍽️' },
  { name: 'workout',       label_ua: 'Тренування',  emoji: '💪' },
  { name: 'goals',         label_ua: 'Цілі',        emoji: '🎯' },
  { name: 'sleep',         label_ua: 'Сон',         emoji: '😴' },
  { name: 'health',        label_ua: "Здоров'я",    emoji: '🏥' },
  { name: 'dreams',        label_ua: 'Сни',         emoji: '🌙' },
  { name: 'books',         label_ua: 'Книги',       emoji: '📚' },
  { name: 'work',          label_ua: 'Робота',      emoji: '💼' },
  { name: 'relationships', label_ua: 'Стосунки',    emoji: '🤝' },
  { name: 'travel',        label_ua: 'Подорожі',    emoji: '✈️' },
  { name: 'gratitude',     label_ua: 'Вдячність',   emoji: '🙏' },
  { name: 'music',         label_ua: 'Музика',      emoji: '🎵' },
  { name: 'social',        label_ua: 'Соціальне',   emoji: '👥' },
];

const DEFAULT_NAMES = new Set(DEFAULT_CATEGORIES.map(c => c.name));
DEFAULT_NAMES.add('uncategorized');

interface DbCategory { name: string; label_ua: string; color: string; }

// ── Sheet body attr helper ────────────────────────────────────────────────────

function useSheetBodyAttr(open: boolean) {
  useEffect(() => {
    if (!open) return;
    const prev = parseInt(document.body.getAttribute('data-sheets-open') ?? '0', 10);
    document.body.setAttribute('data-sheets-open', String(prev + 1));
    return () => {
      const cur = parseInt(document.body.getAttribute('data-sheets-open') ?? '1', 10);
      const next = Math.max(0, cur - 1);
      if (next === 0) document.body.removeAttribute('data-sheets-open');
      else document.body.setAttribute('data-sheets-open', String(next));
    };
  }, [open]);
}

// ── Inline sheet ──────────────────────────────────────────────────────────────

function InlineSheet({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  useSheetBodyAttr(open);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full rounded-t-2xl bg-background px-4 pt-4 pb-8 shadow-2xl">
        <div className="mb-4 flex justify-center"><div className="h-1 w-10 rounded-full bg-muted" /></div>
        {children}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { accessToken } = useAuth();
  const { play } = useSound();

  const [dbCategories, setDbCategories] = useState<DbCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rename sheet
  const [renameTarget, setRenameTarget] = useState<DbCategory | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);

  // Delete sheet
  const [deleteTarget, setDeleteTarget] = useState<DbCategory | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Merge sheet
  const [mergeSource, setMergeSource] = useState<DbCategory | null>(null);
  const [mergeTarget, setMergeTarget] = useState<DbCategory | null>(null);
  const [mergeLoading, setMergeLoading] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    setLoading(true);
    fetch('/api/categories', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.json())
      .then(d => setDbCategories(d.categories ?? []))
      .catch(() => setError('Не вдалося завантажити категорії'))
      .finally(() => setLoading(false));
  }, [accessToken]);

  // Merge DB data with defaults — DB label overrides default label if present
  const dbByName = new Map(dbCategories.map(c => [c.name, c]));

  // Custom = in DB but not in defaults
  const customCats = dbCategories.filter(c => !DEFAULT_NAMES.has(c.name));

  // AI-defined = in DB and in defaults (bot has used them)
  const activatedDefaults = DEFAULT_CATEGORIES.filter(c => dbByName.has(c.name));

  // Pure defaults = never used yet
  const unusedDefaults = DEFAULT_CATEGORIES.filter(c => !dbByName.has(c.name));

  const handleRename = async () => {
    if (!renameTarget || !accessToken) return;
    setRenameLoading(true); setRenameError(null);
    try {
      const res = await fetch('/api/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: renameTarget.name, label_ua: renameValue }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Помилка'); }
      setDbCategories(prev => prev.map(c => c.name === renameTarget.name ? { ...c, label_ua: renameValue } : c));
      setRenameTarget(null);
    } catch (err) {
      setRenameError(err instanceof Error ? err.message : 'Помилка');
      play('CAUTION');
    } finally { setRenameLoading(false); }
  };

  const handleDelete = async () => {
    if (!deleteTarget || !accessToken) return;
    setDeleteLoading(true); setDeleteError(null);
    try {
      const res = await fetch(`/api/categories/${encodeURIComponent(deleteTarget.name)}`, {
        method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Помилка'); }
      setDbCategories(prev => prev.filter(c => c.name !== deleteTarget.name));
      setDeleteTarget(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : 'Помилка');
      play('CAUTION');
    } finally { setDeleteLoading(false); }
  };

  const handleMerge = async () => {
    if (!mergeSource || !mergeTarget || !accessToken) return;
    setMergeLoading(true); setMergeError(null);
    try {
      const res = await fetch('/api/categories/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ source: mergeSource.name, target: mergeTarget.name }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Помилка'); }
      setDbCategories(prev => prev.filter(c => c.name !== mergeSource.name));
      setMergeSource(null); setMergeTarget(null);
    } catch (err) {
      setMergeError(err instanceof Error ? err.message : 'Помилка');
      play('CAUTION');
    } finally { setMergeLoading(false); }
  };

  // All DB cats available as merge targets (excluding source and uncategorized)
  const mergeTargets = dbCategories.filter(c => c.name !== mergeSource?.name && c.name !== 'uncategorized');

  return (
    <div className="flex flex-col gap-6 px-4 pt-5 pb-8">
      <div>
        <h1 className="text-[28px] font-bold leading-tight">Категорії</h1>
        <p className="text-[13px] text-muted-foreground">Управляй категоріями записів</p>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* ── Custom categories ── */}
      {customCats.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Власні
          </p>
          <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden">
            {customCats.map((cat, i) => (
              <div key={cat.name}>
                {i > 0 && <Separator />}
                <CategoryRow
                  label={cat.label_ua}
                  emoji="🏷️"
                  onEdit={() => { play('OPEN'); setRenameTarget(cat); setRenameValue(cat.label_ua); }}
                  onMerge={() => { play('OPEN'); setMergeSource(cat); }}
                  onDelete={() => { play('OPEN'); setDeleteTarget(cat); }}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── AI-activated defaults ── */}
      {activatedDefaults.length > 0 && (
        <section>
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Використовуються
          </p>
          <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden">
            {activatedDefaults.map((cat, i) => {
              const db = dbByName.get(cat.name)!;
              return (
                <div key={cat.name}>
                  {i > 0 && <Separator />}
                  <CategoryRow
                    label={db.label_ua || cat.label_ua}
                    emoji={cat.emoji}
                    onEdit={() => { play('OPEN'); setRenameTarget(db); setRenameValue(db.label_ua); }}
                    onMerge={() => { play('OPEN'); setMergeSource(db); }}
                    onDelete={() => { play('OPEN'); setDeleteTarget(db); }}
                  />
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Unused defaults ── */}
      <section>
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Стандартні
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted border-t-primary" />
          </div>
        ) : (
          <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden">
            {(unusedDefaults.length > 0 ? unusedDefaults : DEFAULT_CATEGORIES).map((cat, i) => (
              <div key={cat.name}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl leading-none w-7 text-center">{cat.emoji}</span>
                  <p className="flex-1 text-[14px] text-foreground/60">{cat.label_ua}</p>
                  <p className="text-[11px] text-muted-foreground/50">Не використовується</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Rename sheet ── */}
      <InlineSheet open={!!renameTarget} onClose={() => { play('CLOSE'); setRenameTarget(null); setRenameError(null); }}>
        <h3 className="mb-3 text-sm font-semibold">Перейменувати категорію</h3>
        <input
          type="text"
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          className="mb-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Нова назва"
          autoFocus
        />
        {renameError && <p className="mb-2 text-xs text-destructive">{renameError}</p>}
        <div className="flex gap-3">
          <button onClick={() => { play('CLOSE'); setRenameTarget(null); setRenameError(null); }} className="flex-1 rounded-full border border-border py-3 text-sm text-muted-foreground">Скасувати</button>
          <button onClick={() => { play('BUTTON'); handleRename(); }} disabled={renameLoading || !renameValue.trim()} className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {renameLoading ? '...' : 'Зберегти'}
          </button>
        </div>
      </InlineSheet>

      {/* ── Delete sheet ── */}
      <InlineSheet open={!!deleteTarget} onClose={() => { play('CLOSE'); setDeleteTarget(null); setDeleteError(null); }}>
        <h3 className="mb-1 text-sm font-semibold">Видалити категорію?</h3>
        <p className="mb-4 text-xs text-muted-foreground">Всі записи з «{deleteTarget?.label_ua}» будуть переміщені до «Без категорії».</p>
        {deleteError && <p className="mb-2 text-xs text-destructive">{deleteError}</p>}
        <div className="flex gap-3">
          <button onClick={() => { play('CLOSE'); setDeleteTarget(null); setDeleteError(null); }} className="flex-1 rounded-full border border-border py-3 text-sm text-muted-foreground">Скасувати</button>
          <button onClick={() => { play('BUTTON'); handleDelete(); }} disabled={deleteLoading} className="flex-1 rounded-full bg-destructive py-3 text-sm font-medium text-destructive-foreground disabled:opacity-50">
            {deleteLoading ? '...' : 'Видалити'}
          </button>
        </div>
      </InlineSheet>

      {/* ── Merge sheet ── */}
      <InlineSheet open={!!mergeSource} onClose={() => { play('CLOSE'); setMergeSource(null); setMergeTarget(null); setMergeError(null); }}>
        <h3 className="mb-1 text-sm font-semibold">Об&apos;єднати «{mergeSource?.label_ua}» з...</h3>
        <p className="mb-3 text-xs text-muted-foreground">Оберіть цільову категорію</p>
        <div className="mb-3 flex flex-col gap-1 max-h-48 overflow-y-auto">
          {mergeTargets.map(c => (
            <button
              key={c.name}
              onClick={() => setMergeTarget(c)}
              className={cn('flex items-center justify-between rounded-xl px-3 py-2.5 text-sm transition-colors', mergeTarget?.name === c.name ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50')}
            >
              {c.label_ua}
              {mergeTarget?.name === c.name && <Icon name="check" size={16} className="text-primary" />}
            </button>
          ))}
          {mergeTargets.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Немає доступних категорій</p>}
        </div>
        {mergeError && <p className="mb-2 text-xs text-destructive">{mergeError}</p>}
        <div className="flex gap-3">
          <button onClick={() => { play('CLOSE'); setMergeSource(null); setMergeTarget(null); setMergeError(null); }} className="flex-1 rounded-full border border-border py-3 text-sm text-muted-foreground">Скасувати</button>
          <button onClick={() => { play('BUTTON'); handleMerge(); }} disabled={mergeLoading || !mergeTarget} className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50">
            {mergeLoading ? '...' : "Об'єднати"}
          </button>
        </div>
      </InlineSheet>
    </div>
  );
}

// ── CategoryRow ───────────────────────────────────────────────────────────────

function CategoryRow({ label, emoji, onEdit, onMerge, onDelete }: {
  label: string;
  emoji: string;
  onEdit: () => void;
  onMerge: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="text-xl leading-none w-7 text-center">{emoji}</span>
      <p className="flex-1 text-[14px] font-medium">{label}</p>
      <div className="flex items-center gap-0.5">
        <button onClick={onEdit} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 transition-colors" aria-label="Перейменувати" style={{ minHeight: 0, minWidth: 0 }}>
          <Icon name="edit" size={15} />
        </button>
        <button onClick={onMerge} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 transition-colors" aria-label="Об'єднати" style={{ minHeight: 0, minWidth: 0 }}>
          <Icon name="merge" size={15} />
        </button>
        <button onClick={onDelete} className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors" aria-label="Видалити" style={{ minHeight: 0, minWidth: 0 }}>
          <Icon name="delete" size={15} />
        </button>
      </div>
    </div>
  );
}
