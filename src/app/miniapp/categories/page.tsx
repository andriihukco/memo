'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/lib/supabase/auth-context';
import { useSound } from '@/lib/sound/use-sound';
import { useI18n } from '@/lib/i18n/context';
import { Icon } from '@/components/ui/icon';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { hapticNotification } from '@/lib/haptics';

// ── Animation variants ────────────────────────────────────────────────────────

const pageVariants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
};

const listItemVariants = {
  initial: { opacity: 0, x: -12 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { duration: 0.28, delay: i * 0.04 },
  }),
};

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

// ── Full emoji library ────────────────────────────────────────────────────────

const EMOJI_OPTIONS = [
  // Health & Body
  '💪','🏃','🧘','🚴','🏋️','🤸','🧗','🏊','⚽','🎾',
  // Food & Drink
  '🍎','🥗','🍕','☕','🧃','🍷','🥤','🍜','🥑','🍳',
  // Mind & Mood
  '🧠','💭','😊','😴','🎯','⚡','🔥','💡','✨','🌟',
  // Nature
  '🌿','🌸','🌊','☀️','🌙','🍀','🌺','🦋','🌈','❄️',
  // Finance
  '💰','💳','📈','💸','🏦','🛒','🎁','💎','🪙','📊',
  // Work & Learning
  '💻','📚','✏️','🎓','🔬','📝','🗂️','🏆','🎨','🎵',
  // Travel & Places
  '✈️','🏠','🗺️','🚗','🚂','⛵','🏔️','🌍','🏖️','🗼',
  // People & Social
  '❤️','🤝','👶','🐾','👥','🙏','🎉','🥂','💌','🫂',
  // Tracking & Metrics
  '⏱️','📏','🔢','📉','🎲','🔐','🧪','⚗️','🔭','🧬',
  // Misc
  '⭐','🏅','🎖️','🔑','💫','🌀','🎭','🎪','🎬','🎤',
  // Extra
  '🏷️','🔥','💎','🎸','🎹','🌻','🍁','🐉','🦄','🦅',
  '🍔','🍣','🍰','🧁','🍩','🏡','🏰','📱','📷','🎥',
  '🎮','🕹️','🎲','🎯','🥇','🏆','🎊','🎀','🎁','🎉',
];

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
  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300, mass: 0.8 }}
            className="relative w-full rounded-t-2xl bg-background px-4 pt-4 pb-8 shadow-2xl"
          >
            <div className="mb-4 flex justify-center">
              <motion.div
                className="h-1 w-10 rounded-full bg-muted"
                whileHover={{ scaleX: 1.2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              />
            </div>
            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

// ── Emoji picker ──────────────────────────────────────────────────────────────

function EmojiPicker({ selected, onSelect }: { selected: string; onSelect: (emoji: string) => void }) {
  return (
    <div className="grid grid-cols-10 gap-1 max-h-48 overflow-y-auto py-1">
      {EMOJI_OPTIONS.map(emoji => (
        <button
          key={emoji}
          type="button"
          onClick={() => onSelect(emoji)}
          className={cn(
            'flex h-9 w-full items-center justify-center rounded-xl text-xl transition-colors',
            selected === emoji ? 'bg-primary/20 ring-1 ring-primary' : 'hover:bg-muted/60'
          )}
        >
          {emoji}
        </button>
      ))}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function CategoriesPage() {
  const { accessToken } = useAuth();
  const { play } = useSound();
  const { t } = useI18n();

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

  // Create custom category sheet
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createEmoji, setCreateEmoji] = useState('🏷️');
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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

  const handleCreate = async () => {
    if (!accessToken || !createName.trim()) return;
    setCreateLoading(true); setCreateError(null);
    // Derive a slug-like name from the label
    const slug = createName.trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_а-яіїєґ]/gi, '')
      .slice(0, 40) || `custom_${Date.now()}`;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: slug, label_ua: createName.trim(), color: createEmoji }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Помилка'); }
      const d = await res.json();
      setDbCategories(prev => [...prev, d.category ?? { name: slug, label_ua: createName.trim(), color: createEmoji }]);
      play('CELEBRATION');
      setShowCreate(false);
      setCreateName('');
      setCreateEmoji('🏷️');
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Помилка');
      play('CAUTION');
    } finally { setCreateLoading(false); }
  };

  // All DB cats available as merge targets (excluding source and uncategorized)
  const mergeTargets = dbCategories.filter(c => c.name !== mergeSource?.name && c.name !== 'uncategorized');

  // Emoji for a custom category — stored in color field or fallback
  const customEmoji = (cat: DbCategory) => {
    if (cat.color && EMOJI_OPTIONS.includes(cat.color)) return cat.color;
    return '🏷️';
  };

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="flex flex-col gap-6 px-4 pt-5 pb-8"
    >
      {/* ── Header — centered title ── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
        className="text-center"
      >
        <h1 className="text-[28px] font-bold leading-tight">Категорії</h1>
        <p className="text-[13px] text-muted-foreground">Управляй категоріями записів</p>
      </motion.div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {/* ── Custom categories ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Власні
          </p>
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => { play('OPEN'); setShowCreate(true); }}
            className="flex items-center gap-1 rounded-full bg-primary/10 px-3 py-1 text-[12px] font-medium text-primary transition-colors hover:bg-primary/20"
          >
            <Icon name="add" size={14} />
            Нова
          </motion.button>
        </div>
        {customCats.length > 0 ? (
          <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden">
            {customCats.map((cat, i) => (
              <motion.div
                key={cat.name}
                custom={i}
                variants={listItemVariants}
                initial="initial"
                animate="animate"
              >
                {i > 0 && <Separator />}
                <CategoryRow
                  label={cat.label_ua}
                  emoji={customEmoji(cat)}
                  onEdit={() => { play('OPEN'); setRenameTarget(cat); setRenameValue(cat.label_ua); }}
                  onMerge={() => { play('OPEN'); setMergeSource(cat); }}
                  onDelete={() => { play('OPEN'); setDeleteTarget(cat); }}
                />
              </motion.div>
            ))}
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={() => { play('OPEN'); setShowCreate(true); }}
            className="w-full rounded-2xl border border-dashed border-border/50 py-5 text-center text-[13px] text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
          >
            + Створити власну категорію
          </motion.button>
        )}
      </motion.section>

      {/* ── AI-activated defaults ── */}
      {activatedDefaults.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Використовуються
          </p>
          <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden">
            {activatedDefaults.map((cat, i) => {
              const db = dbByName.get(cat.name)!;
              return (
                <motion.div
                  key={cat.name}
                  custom={i}
                  variants={listItemVariants}
                  initial="initial"
                  animate="animate"
                >
                  {i > 0 && <Separator />}
                  <CategoryRow
                    label={db.label_ua || cat.label_ua}
                    emoji={cat.emoji}
                    onEdit={() => { play('OPEN'); setRenameTarget(db); setRenameValue(db.label_ua); }}
                    onMerge={() => { play('OPEN'); setMergeSource(db); }}
                    onDelete={() => { play('OPEN'); setDeleteTarget(db); }}
                  />
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}

      {/* ── Unused defaults ── */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          Стандартні
        </p>
        {loading ? (
          <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden">
            {[0,1,2,3,4].map(i => (
              <div key={i}>
                {i > 0 && <div className="h-px bg-border/30" />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="h-7 w-7 rounded-xl bg-muted/60 animate-pulse" />
                  <div className="h-4 flex-1 rounded-lg bg-muted/60 animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl bg-card/60 border border-border/30 overflow-hidden">
            {(unusedDefaults.length > 0 ? unusedDefaults : DEFAULT_CATEGORIES).map((cat, i) => (
              <motion.div
                key={cat.name}
                custom={i}
                variants={listItemVariants}
                initial="initial"
                animate="animate"
              >
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl leading-none w-7 text-center">{cat.emoji}</span>
                  <p className="flex-1 text-[14px] text-foreground/60">{cat.label_ua}</p>
                  <p className="text-[11px] text-muted-foreground/50">Не використовується</p>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </motion.section>

      {/* ── Create custom category sheet ── */}
      <InlineSheet open={showCreate} onClose={() => { play('CLOSE'); setShowCreate(false); setCreateError(null); setCreateName(''); setCreateEmoji('🏷️'); }}>
        <h3 className="mb-3 text-sm font-semibold">Нова категорія</h3>
        {/* Emoji + name row */}
        <div className="mb-3 flex items-center gap-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-2xl">
            {createEmoji}
          </div>
          <input
            type="text"
            value={createName}
            onChange={e => setCreateName(e.target.value)}
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            placeholder={t('miniapp.categories.name_placeholder')}
            autoFocus
            maxLength={40}
          />
        </div>
        {/* Emoji picker */}
        <div className="mb-3 rounded-xl border border-border/40 bg-muted/20 p-2">
          <EmojiPicker selected={createEmoji} onSelect={setCreateEmoji} />
        </div>
        {createError && <p className="mb-2 text-xs text-destructive">{createError}</p>}
        <div className="flex gap-3">
          <button
            onClick={() => { play('CLOSE'); setShowCreate(false); setCreateError(null); setCreateName(''); setCreateEmoji('🏷️'); }}
            className="flex-1 rounded-full border border-border py-3 text-sm text-muted-foreground"
          >
            Скасувати
          </button>
          <button
            onClick={() => { play('BUTTON'); handleCreate(); }}
            disabled={createLoading || !createName.trim()}
            className="flex-1 rounded-full bg-primary py-3 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {createLoading ? '...' : 'Створити'}
          </button>
        </div>
      </InlineSheet>

      {/* ── Rename sheet ── */}
      <InlineSheet open={!!renameTarget} onClose={() => { play('CLOSE'); setRenameTarget(null); setRenameError(null); }}>
        <h3 className="mb-3 text-sm font-semibold">Перейменувати категорію</h3>
        <input
          type="text"
          value={renameValue}
          onChange={e => setRenameValue(e.target.value)}
          className="mb-3 w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder={t('miniapp.categories.new_name_placeholder')}
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
          <button onClick={() => { play('BUTTON'); hapticNotification('warning'); handleDelete(); }} disabled={deleteLoading} className="flex-1 rounded-full bg-destructive py-3 text-sm font-medium text-destructive-foreground disabled:opacity-50">
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
            {mergeLoading ? '...' : t('miniapp.categories.merge_button')}
          </button>
        </div>
      </InlineSheet>
    </motion.div>
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
    <motion.div
      className="flex items-center gap-3 px-4 py-3"
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.02)' }}
      transition={{ duration: 0.15 }}
    >
      <span className="text-xl leading-none w-7 text-center">{emoji}</span>
      <p className="flex-1 text-[14px] font-medium">{label}</p>
      <div className="flex items-center gap-0.5">
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onEdit}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 transition-colors"
          aria-label="Перейменувати"
          style={{ minHeight: 0, minWidth: 0 }}
        >
          <Icon name="edit" size={15} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onMerge}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 transition-colors"
          aria-label="Об'єднати"
          style={{ minHeight: 0, minWidth: 0 }}
        >
          <Icon name="merge" size={15} />
        </motion.button>
        <motion.button
          whileTap={{ scale: 0.88 }}
          onClick={onDelete}
          className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          aria-label="Видалити"
          style={{ minHeight: 0, minWidth: 0 }}
        >
          <Icon name="delete" size={15} />
        </motion.button>
      </div>
    </motion.div>
  );
}