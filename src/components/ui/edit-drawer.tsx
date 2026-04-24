'use client';

import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Category helpers ──────────────────────────────────────────────────────────
// These are used by other components (feed, dashboard, graph) for badge colors/labels.
// They work with a static fallback palette when no DB data is available,
// but the EditDrawer always loads live data from /api/categories.

const STATIC_COLORS: Record<string, string> = {
  // Dark mode optimized: translucent bg, vibrant text, subtle border
  thoughts: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  ideas: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  feelings: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  expenses: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  calories: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  workout: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  dreams: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  relationships: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  health: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  travel: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  books: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
  gratitude: 'bg-lime-500/15 text-lime-400 border-lime-500/30',
  goals: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
  sleep: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30',
  music: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  work: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  social: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  career: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  sex_life: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  sport: 'bg-green-500/15 text-green-400 border-green-500/30',
  food: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  finance: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  meditation: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  hobby: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  family: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  friends: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  nature: 'bg-green-500/15 text-green-400 border-green-500/30',
  art: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  learning: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
};

const STATIC_LABELS: Record<string, string> = {
  thoughts: 'Думки', ideas: 'Ідеї', feelings: 'Почуття',
  expenses: 'Витрати', calories: 'Калорії', workout: 'Тренування',
  dreams: 'Сни', relationships: 'Стосунки', health: "Здоров'я",
  travel: 'Подорожі', books: 'Книги', gratitude: 'Вдячність',
  goals: 'Цілі', sleep: 'Сон', music: 'Музика',
  work: 'Робота', career: "Кар'єра", social: 'Соціальне',
  sex_life: 'Інтимне', sport: 'Спорт', food: 'Їжа',
  finance: 'Фінанси', meditation: 'Медитація', hobby: 'Хобі',
  family: "Сім'я", friends: 'Друзі', nature: 'Природа',
  art: 'Мистецтво', learning: 'Навчання',
};

const FALLBACK_PALETTE = [
  // Dark mode optimized fallback palette
  'bg-violet-500/15 text-violet-400 border-violet-500/30',
  'bg-teal-500/15 text-teal-400 border-teal-500/30',
  'bg-rose-500/15 text-rose-400 border-rose-500/30',
  'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  'bg-lime-500/15 text-lime-400 border-lime-500/30',
  'bg-sky-500/15 text-sky-400 border-sky-500/30',
  'bg-amber-500/15 text-amber-400 border-amber-500/30',
  'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
];

function hashPalette(cat: string): string {
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffffffff;
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

// Runtime cache — populated by the first EditDrawer that loads categories
// so other components can call getCategoryColor/getCategoryLabel consistently.
const _runtimeLabels: Record<string, string> = {};
const _runtimeColors: Record<string, string> = {};

export function getCategoryLabel(cat: string, serverLabel?: string): string {
  if (_runtimeLabels[cat]) return _runtimeLabels[cat];
  if (STATIC_LABELS[cat]) return STATIC_LABELS[cat];
  if (serverLabel) return serverLabel;
  return cat.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export function getCategoryColor(cat: string): string {
  if (_runtimeColors[cat]) return _runtimeColors[cat];
  if (STATIC_COLORS[cat]) return STATIC_COLORS[cat];
  return hashPalette(cat);
}

export const categoryBadge = getCategoryColor;

// ── DB category type ──────────────────────────────────────────────────────────

interface DbCategory {
  name: string;
  label_ua: string;
  color: string;
}

// ── EditDrawer ────────────────────────────────────────────────────────────────

interface EditEntry {
  id: string;
  content: string;
  category: string;
}

interface EditDrawerProps {
  entry: EditEntry;
  onSave: (id: string, content: string, category: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onClose: () => void;
  accessToken?: string | null;
}

export function EditDrawer({ entry, onSave, onDelete, onClose, accessToken }: EditDrawerProps) {
  const initialCats = entry.category.split(',').map(s => s.trim()).filter(Boolean);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set(initialCats));
  const [customInput, setCustomInput] = useState('');
  const [editContent, setEditContent] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // All categories from DB — single source of truth
  const [dbCats, setDbCats] = useState<DbCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load all user categories from DB, then merge with built-ins so all standard
  // categories always appear even if the user hasn't logged them yet.
  useEffect(() => {
    // Built-ins always shown regardless of DB state - dark mode optimized
    const BUILTIN_SEED: DbCategory[] = [
      { name: 'thoughts', label_ua: 'Думки', color: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30' },
      { name: 'ideas', label_ua: 'Ідеї', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
      { name: 'feelings', label_ua: 'Почуття', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
      { name: 'expenses', label_ua: 'Витрати', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
      { name: 'calories', label_ua: 'Калорії', color: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
      { name: 'workout', label_ua: 'Тренування', color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
      { name: 'goals', label_ua: 'Цілі', color: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
      { name: 'sleep', label_ua: 'Сон', color: 'bg-fuchsia-500/15 text-fuchsia-400 border-fuchsia-500/30' },
      { name: 'health', label_ua: "Здоров'я", color: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
      { name: 'dreams', label_ua: 'Сни', color: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
      { name: 'books', label_ua: 'Книги', color: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
      { name: 'work', label_ua: 'Робота', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
      { name: 'relationships', label_ua: 'Стосунки', color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
      { name: 'travel', label_ua: 'Подорожі', color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
      { name: 'gratitude', label_ua: 'Вдячність', color: 'bg-lime-500/15 text-lime-400 border-lime-500/30' },
      { name: 'music', label_ua: 'Музика', color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
      { name: 'social', label_ua: 'Соціальне', color: 'bg-pink-500/15 text-pink-400 border-pink-500/30' },
    ];

    if (!accessToken) {
      // No token — show built-ins only
      setDbCats(BUILTIN_SEED);
      setLoadingCats(false);
      return;
    }

    fetch('/api/categories', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : { categories: [] })
      .then((d: { categories: DbCategory[] }) => {
        const fromDb = d.categories ?? [];
        const dbNames = new Set(fromDb.map(c => c.name));

        // Merge: built-ins first (in order), then any user-created extras from DB
        const merged: DbCategory[] = [
          ...BUILTIN_SEED,
          ...fromDb.filter(c => !BUILTIN_SEED.some(b => b.name === c.name)),
        ];

        // Populate runtime cache
        for (const c of merged) {
          _runtimeLabels[c.name] = c.label_ua;
          _runtimeColors[c.name] = c.color.includes('border-')
            ? c.color
            : c.color + ' border-' + (c.color.match(/text-(\S+)/)?.[1]?.replace('700', '200') ?? 'gray-200');
        }

        // Also cache DB-only entries (may have different label_ua from user edits)
        for (const c of fromDb) {
          if (dbNames.has(c.name)) {
            _runtimeLabels[c.name] = c.label_ua; // DB label takes priority
          }
        }

        setDbCats(merged);
      })
      .catch(() => {
        setDbCats(BUILTIN_SEED);
      })
      .finally(() => setLoadingCats(false));
  }, [accessToken]);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  const toggleCat = (cat: string) => {
    setSelectedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        if (next.size > 1) next.delete(cat); // always keep at least one
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const addCustom = async () => {
    const raw = customInput.trim();
    if (!raw) return;
    const name = raw.toLowerCase().replace(/\s+/g, '_');
    const label = raw.replace(/^\w/, c => c.toUpperCase());

    // Optimistically add to UI
    setSelectedCats(prev => new Set([...prev, name]));
    setCustomInput('');

    // Persist to DB immediately so it's available for future edits
    if (accessToken) {
      try {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ name, label, color: hashPalette(name) }),
        });
        // Add to local dbCats so it shows in the chip list right away
        const color = hashPalette(name);
        const newCat: DbCategory = { name, label_ua: label, color };
        _runtimeLabels[name] = label;
        _runtimeColors[name] = color;
        setDbCats(prev => prev.some(c => c.name === name) ? prev : [...prev, newCat]);
      } catch { /* ignore */ }
    }
  };

  const save = async () => {
    const finalCategory = [...selectedCats].join(',');
    const finalContent = editContent.trim();
    if (!finalContent) return;
    setSaving(true);
    try {
      await onSave(entry.id, finalContent, finalCategory);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(entry.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  // Chips to show: DB categories + any selected cats not yet in DB
  const dbNames = new Set(dbCats.map(c => c.name));
  const extraSelected = [...selectedCats].filter(c => !dbNames.has(c));

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div
        className="relative w-full rounded-t-2xl bg-background px-4 pt-4 shadow-2xl"
        style={{ paddingBottom: 'calc(max(var(--bottom-inset, 0px), 16px) + 1rem)' }}
      >
        {/* Handle */}
        <div className="mb-3 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
          aria-label="Закрити"
        >
          <X size={14} />
        </button>

        {/* Delete */}
        {onDelete && !confirmDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors"
            aria-label="Видалити"
          >
            <Trash2 size={14} />
          </button>
        )}

        {confirmDelete && (
          <div className="mb-3 flex items-center gap-2 rounded-2xl bg-red-50 px-3 py-2.5">
            <Trash2 size={14} className="shrink-0 text-red-500" />
            <span className="flex-1 text-xs text-red-700">Видалити запис?</span>
            <button onClick={() => setConfirmDelete(false)} className="rounded-full px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted">Ні</button>
            <button onClick={handleDelete} disabled={deleting} className="rounded-full bg-red-500 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60">
              {deleting ? '...' : 'Так'}
            </button>
          </div>
        )}

        {/* Category chips — sourced entirely from DB */}
        <div className="mb-3 flex flex-wrap gap-1.5 pr-10">
          {loadingCats && (
            <div className="h-6 w-24 animate-pulse rounded-full bg-muted" />
          )}
          {!loadingCats && dbCats.map((cat) => {
            const color = getCategoryColor(cat.name);
            const isSelected = selectedCats.has(cat.name);
            return (
              <button
                key={cat.name}
                onClick={() => toggleCat(cat.name)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                  color,
                  isSelected ? 'ring-2 ring-offset-1 ring-primary/50 scale-105' : 'opacity-55 hover:opacity-80'
                )}
              >
                {cat.label_ua || getCategoryLabel(cat.name)}
              </button>
            );
          })}
          {/* Extra selected cats not yet in DB (edge case) */}
          {extraSelected.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                getCategoryColor(cat),
                'ring-2 ring-offset-1 ring-primary/50 scale-105'
              )}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* Add custom category */}
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            placeholder="Додати свою категорію..."
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {customInput.trim() && (
            <button onClick={addCustom} className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              +
            </button>
          )}
        </div>

        {/* Content */}
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={e => setEditContent(e.target.value)}
          rows={4}
          className="mb-4 w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
        />

        <Button className="w-full rounded-full" disabled={saving || !editContent.trim()} onClick={save}>
          {saving
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            : 'Зберегти'}
        </Button>
      </div>
    </div>
  );
}
