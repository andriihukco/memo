'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/legacy/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useSound } from '@/lib/sound/use-sound';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { ICON_LIBRARY, COLOR_PALETTE } from '@/lib/categories';
export { ICON_LIBRARY, COLOR_PALETTE };

// ── Icon library (Material Symbols names for categories) ──────────────────────

export function getIconName(label?: string): string {
  return ICON_LIBRARY.find(i => i.label === label)?.name ?? 'tag';
}

// ── 36-color palette ──────────────────────────────────────────────────────────

export type ColorId = typeof COLOR_PALETTE[number]['id'];

export function colorFromId(id: string) {
  return COLOR_PALETTE.find(c => c.id === id) ?? COLOR_PALETTE[15]; // default indigo
}

/** Build a full Tailwind color string from a color id */
export function colorStringFromId(id: string): string {
  const c = colorFromId(id);
  return `${c.bg} ${c.text} ${c.border}`;
}

/** Detect color id from an existing Tailwind color string */
export function colorIdFromString(colorStr: string): string {
  const match = COLOR_PALETTE.find(c => colorStr.includes(c.bg) || colorStr.includes(c.text));
  return match?.id ?? 'indigo';
}

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

// ── Emoji picker for new category ────────────────────────────────────────────

const EMOJI_GROUPS: { label: string; emojis: string[] }[] = [
  {
    label: 'Спорт',
    emojis: ['💪','🏃','🧘','🚴','🏋️','🤸','🧗','🏊','⚽','🎾','🏀','🏈','⚾','🎱','🏓','🥊','🤼','🏇','🎿','🛹'],
  },
  {
    label: 'Їжа',
    emojis: ['🍎','🥗','🍕','☕','🧃','🍷','🥤','🍜','🥑','🍳','🍔','🍣','🍰','🧁','🍩','🥐','🥩','🥦','🍇','🍓'],
  },
  {
    label: 'Розум',
    emojis: ['🧠','💭','😊','😴','🎯','⚡','🔥','💡','✨','🌟','🤔','😌','😤','🥳','😎','🧐','🤩','😇','🥰','😤'],
  },
  {
    label: 'Природа',
    emojis: ['🌿','🌸','🌊','☀️','🌙','🍀','🌺','🦋','🌈','❄️','🌻','🍁','🐉','🦄','🦅','🌴','🌵','🍄','🐬','🦁'],
  },
  {
    label: 'Фінанси',
    emojis: ['💰','💳','📈','💸','🏦','🛒','🎁','💎','🪙','📊','📉','🏧','💹','🤑','🏷️','🛍️','🎰','🪄','🔑','🗝️'],
  },
  {
    label: 'Робота',
    emojis: ['💻','📚','✏️','🎓','🔬','📝','🗂️','🏆','🎨','🎵','📱','📷','🎥','🎮','🕹️','🎸','🎹','🎤','🎧','🖥️'],
  },
  {
    label: 'Подорожі',
    emojis: ['✈️','🏠','🗺️','🚗','🚂','⛵','🏔️','🌍','🏖️','🗼','🏡','🏰','🚀','🛸','🚁','🛺','🚢','🏕️','🗽','🎡'],
  },
  {
    label: 'Люди',
    emojis: ['❤️','🤝','👶','🐾','👥','🙏','🎉','🥂','💌','🫂','👨‍👩‍👧','💑','🤗','👏','🫶','💪','🙌','🤲','👐','🫵'],
  },
  {
    label: 'Метрики',
    emojis: ['⏱️','📏','🔢','📉','🎲','🔐','🧪','⚗️','🔭','🧬','⚖️','🌡️','🔋','💊','🩺','🩻','🧫','🔩','⚙️','🛠️'],
  },
  {
    label: 'Інше',
    emojis: ['⭐','🏅','🎖️','💫','🌀','🎭','🎪','🎬','🎊','🎀','🎁','🎉','🪅','🎠','🎡','🎢','🎯','🎳','🎲','🃏'],
  },
];

interface DbCategory {
  name: string;
  label_ua: string;
  color: string;
  icon?: string;
  emoji?: string;
}

// ── NewCategorySheet — emoji + color picker for custom categories ─────────────

interface NewCategorySheetProps {
  initialName: string;
  onConfirm: (name: string, label: string, colorId: string, emoji: string) => void;
  onCancel: () => void;
}

function NewCategorySheet({ initialName, onConfirm, onCancel }: NewCategorySheetProps) {
  const [label, setLabel] = useState(initialName.replace(/^\w/, c => c.toUpperCase()));
  const [selectedColor, setSelectedColor] = useState<string>('indigo');
  const [selectedEmoji, setSelectedEmoji] = useState<string>('💡');
  const [activeTab, setActiveTab] = useState<'color' | 'emoji'>('color');
  const [activeGroup, setActiveGroup] = useState(0);
  const color = colorFromId(selectedColor);

  return (
    <div className="fixed inset-0 z-[70] flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        className="relative w-full rounded-t-2xl bg-background shadow-2xl flex flex-col"
        style={{ maxHeight: '88vh', paddingBottom: 'calc(max(var(--bottom-inset, 0px), 16px) + 0.5rem)' }}
      >
        {/* Handle */}
        <div className="pt-3 pb-1 flex justify-center shrink-0">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        {/* Header row: back btn + centered title */}
        <div className="relative flex items-center justify-center px-4 py-2 shrink-0">
          <button
            onClick={onCancel}
            className="absolute left-4 flex h-8 w-8 items-center justify-center rounded-full bg-muted/70 text-muted-foreground hover:bg-muted transition-colors"
            aria-label="Назад"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="text-center">
            <p className="text-[15px] font-semibold leading-tight">Іконка</p>
            <p className="text-[12px] text-muted-foreground leading-tight">Оберіть емодзі та колір</p>
          </div>
        </div>

        {/* Preview icon + name input */}
        <div className="px-4 pt-3 pb-4 shrink-0">
          {/* Big icon preview */}
          <div className="flex justify-center mb-4">
            <div
              className={cn(
                'flex h-20 w-20 items-center justify-center rounded-[22px] text-4xl shadow-lg border',
                color.bg, color.border
              )}
            >
              {selectedEmoji}
            </div>
          </div>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Назва категорії"
            className="w-full rounded-xl border border-input bg-muted/30 px-4 py-2.5 text-sm font-medium text-center focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
        </div>

        {/* Tabs */}
        <div className="px-4 mb-3 shrink-0">
          <div className="flex rounded-xl bg-muted/40 p-1 gap-1">
            <button
              onClick={() => setActiveTab('color')}
              className={cn(
                'flex-1 rounded-lg py-2 text-[13px] font-medium transition-all',
                activeTab === 'color'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              🎨 Колір
            </button>
            <button
              onClick={() => setActiveTab('emoji')}
              className={cn(
                'flex-1 rounded-lg py-2 text-[13px] font-medium transition-all',
                activeTab === 'emoji'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              😊 Емодзі
            </button>
          </div>
        </div>

        {/* Tab content — scrollable */}
        <div className="flex-1 overflow-y-auto px-4 min-h-0">
          {activeTab === 'color' && (
            <div className="grid grid-cols-9 gap-2 py-1 pb-4">
              {COLOR_PALETTE.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedColor(c.id)}
                  className={cn(
                    'h-8 w-8 rounded-full transition-all active:scale-90',
                    selectedColor === c.id && 'ring-2 ring-offset-2 ring-white/70 scale-110'
                  )}
                  style={{ backgroundColor: c.hex }}
                  aria-label={c.id}
                />
              ))}
            </div>
          )}

          {activeTab === 'emoji' && (
            <div className="pb-4">
              {/* Group tabs — horizontal scroll */}
              <div className="flex gap-1.5 overflow-x-auto pb-2 mb-3 scrollbar-none" style={{ scrollbarWidth: 'none' }}>
                {EMOJI_GROUPS.map((g, i) => (
                  <button
                    key={g.label}
                    onClick={() => setActiveGroup(i)}
                    className={cn(
                      'shrink-0 rounded-full px-3 py-1 text-[12px] font-medium transition-all whitespace-nowrap',
                      activeGroup === i
                        ? cn(color.bg, color.text, 'border', color.border)
                        : 'bg-muted/40 text-muted-foreground hover:bg-muted/70'
                    )}
                  >
                    {g.label}
                  </button>
                ))}
              </div>

              {/* Emoji grid for active group */}
              <div className="grid grid-cols-10 gap-1.5">
                {EMOJI_GROUPS[activeGroup].emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => setSelectedEmoji(emoji)}
                    className={cn(
                      'flex h-9 w-full items-center justify-center rounded-xl text-xl transition-all active:scale-90',
                      selectedEmoji === emoji
                        ? cn(color.bg, color.border, 'border ring-1 ring-offset-1 ring-white/30')
                        : 'hover:bg-muted/60'
                    )}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Action button */}
        <div className="px-4 pt-2 shrink-0">
          <button
            onClick={() => {
              const name = initialName.toLowerCase().replace(/\s+/g, '_');
              onConfirm(name, label.trim() || name, selectedColor, selectedEmoji);
            }}
            disabled={!label.trim()}
            className={cn(
              'w-full rounded-2xl py-4 text-[15px] font-semibold transition-all disabled:opacity-40',
              color.bg, color.text, 'border', color.border
            )}
          >
            Додати категорію
          </button>
        </div>
      </div>
    </div>
  );
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
  const [showNewCatSheet, setShowNewCatSheet] = useState(false);
  const [editContent, setEditContent] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // All categories from DB — single source of truth
  const [dbCats, setDbCats] = useState<DbCategory[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { play } = useSound();

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
    // Open the icon/color picker sheet instead of immediately adding
    setShowNewCatSheet(true);
  };

  const handleNewCatConfirm = async (name: string, label: string, colorId: string, emoji: string) => {
    setShowNewCatSheet(false);
    setCustomInput('');
    const colorStr = colorStringFromId(colorId);

    // Optimistically add to UI
    setSelectedCats(prev => new Set([...prev, name]));

    // Persist to DB
    if (accessToken) {
      try {
        await fetch('/api/categories', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
          body: JSON.stringify({ name, label, color: colorStr, emoji }),
        });
        const newCat: DbCategory = { name, label_ua: label, color: colorStr, emoji };
        _runtimeLabels[name] = label;
        _runtimeColors[name] = colorStr;
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
    <>
      <BottomSheet open onClose={onClose} className="px-4 pt-4 max-h-[90vh] overflow-y-auto">
        {/* Close */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
          aria-label="Закрити"
        >
          <Icon name="close" size={16} />
        </button>

        {/* Delete */}
        {onDelete && (
          <button
            onClick={() => setConfirmDelete(true)}
            className="absolute left-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-red-100 hover:text-red-600 transition-colors"
            aria-label="Видалити"
          >
            <Icon name="delete" size={16} />
          </button>
        )}

        {/* Category chips — sourced entirely from DB */}
        <div className="mb-3 mt-3 flex flex-wrap gap-1.5 pr-10">
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
                  'flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                  color,
                  isSelected ? 'ring-2 ring-offset-1 ring-primary/50 scale-105' : 'opacity-55 hover:opacity-80'
                )}
              >
                {cat.emoji
                  ? <span className="text-[11px] leading-none">{cat.emoji}</span>
                  : <Icon name={getIconName(cat.icon)} size={11} />
                }
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
            placeholder="Нова категорія..."
            value={customInput}
            onChange={e => { play('TYPE'); setCustomInput(e.target.value); }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {customInput.trim() && (
            <button
              onClick={addCustom}
              className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground"
            >
              Далі →
            </button>
          )}
        </div>

        {/* Content */}
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={e => { play('TYPE'); setEditContent(e.target.value); }}
          rows={4}
          className="mb-4 w-full resize-none rounded-2xl border border-input bg-background px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
        />

        <Button className="w-full min-h-[44px] rounded-full mb-2" disabled={saving || !editContent.trim()} onClick={save}>
          {saving
            ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            : 'Зберегти'}
        </Button>
      </BottomSheet>

      {/* New category icon/color picker */}
      {showNewCatSheet && (
        <NewCategorySheet
          initialName={customInput.trim()}
          onConfirm={handleNewCatConfirm}
          onCancel={() => setShowNewCatSheet(false)}
        />
      )}

      {/* Delete confirm */}
      <ConfirmSheet
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
        title="Видалити запис?"
        subtitle="Цю дію не можна скасувати."
        confirmLabel={deleting ? '...' : 'Видалити'}
      />
    </>
  );
}
