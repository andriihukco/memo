'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useSound } from '@/lib/sound/use-sound';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';

// ── Icon library (Material Symbols names for categories) ──────────────────────

export const ICON_LIBRARY: { name: string; label: string }[] = [
  { name: 'tag', label: 'tag' },
  { name: 'neurology', label: 'brain' },
  { name: 'lightbulb', label: 'lightbulb' },
  { name: 'favorite', label: 'heart' },
  { name: 'account_balance_wallet', label: 'wallet' },
  { name: 'local_fire_department', label: 'flame' },
  { name: 'fitness_center', label: 'dumbbell' },
  { name: 'my_location', label: 'target' },
  { name: 'bedtime', label: 'moon' },
  { name: 'auto_awesome', label: 'sparkles' },
  { name: 'menu_book', label: 'book' },
  { name: 'work', label: 'briefcase' },
  { name: 'group', label: 'users' },
  { name: 'location_on', label: 'map-pin' },
  { name: 'music_note', label: 'music' },
  { name: 'sentiment_satisfied', label: 'smile' },
  { name: 'bolt', label: 'zap' },
  { name: 'monitor_heart', label: 'activity' },
  { name: 'water_drop', label: 'droplets' },
  { name: 'scale', label: 'scale' },
  { name: 'air', label: 'wind' },
  { name: 'coffee', label: 'coffee' },
  { name: 'restaurant', label: 'utensils' },
  { name: 'photo_camera', label: 'camera' },
  { name: 'edit', label: 'pen' },
  { name: 'star', label: 'star' },
  { name: 'wb_sunny', label: 'sun' },
  { name: 'cloud', label: 'cloud' },
  { name: 'eco', label: 'leaf' },
  { name: 'home', label: 'home' },
  { name: 'directions_car', label: 'car' },
  { name: 'flight', label: 'plane' },
  { name: 'shopping_bag', label: 'shopping-bag' },
  { name: 'medication', label: 'pill' },
  { name: 'child_care', label: 'baby' },
  { name: 'pets', label: 'dog' },
  { name: 'sports_esports', label: 'gamepad' },
  { name: 'code', label: 'code' },
  { name: 'palette', label: 'palette' },
  { name: 'mic', label: 'mic' },
  { name: 'headphones', label: 'headphones' },
  { name: 'language', label: 'globe' },
  { name: 'trending_up', label: 'trending-up' },
  { name: 'schedule', label: 'clock' },
  { name: 'emoji_events', label: 'award' },
  { name: 'layers', label: 'layers' },
  { name: 'visibility', label: 'eye' },
  { name: 'anchor', label: 'anchor' },
  { name: 'explore', label: 'compass' },
];

export function getIconName(label?: string): string {
  return ICON_LIBRARY.find(i => i.label === label)?.name ?? 'tag';
}

// ── 36-color palette ──────────────────────────────────────────────────────────
// Each entry: { id, bg (Tailwind), text (Tailwind), border (Tailwind), hex (for swatch) }

export const COLOR_PALETTE = [
  { id: 'slate',   bg: 'bg-slate-500/15',   text: 'text-slate-400',   border: 'border-slate-500/30',   hex: '#94a3b8' },
  { id: 'gray',    bg: 'bg-gray-500/15',    text: 'text-gray-400',    border: 'border-gray-500/30',    hex: '#9ca3af' },
  { id: 'zinc',    bg: 'bg-zinc-500/15',    text: 'text-zinc-400',    border: 'border-zinc-500/30',    hex: '#a1a1aa' },
  { id: 'stone',   bg: 'bg-stone-500/15',   text: 'text-stone-400',   border: 'border-stone-500/30',   hex: '#a8a29e' },
  { id: 'red',     bg: 'bg-red-500/15',     text: 'text-red-400',     border: 'border-red-500/30',     hex: '#f87171' },
  { id: 'orange',  bg: 'bg-orange-500/15',  text: 'text-orange-400',  border: 'border-orange-500/30',  hex: '#fb923c' },
  { id: 'amber',   bg: 'bg-amber-500/15',   text: 'text-amber-400',   border: 'border-amber-500/30',   hex: '#fbbf24' },
  { id: 'yellow',  bg: 'bg-yellow-500/15',  text: 'text-yellow-400',  border: 'border-yellow-500/30',  hex: '#facc15' },
  { id: 'lime',    bg: 'bg-lime-500/15',    text: 'text-lime-400',    border: 'border-lime-500/30',    hex: '#a3e635' },
  { id: 'green',   bg: 'bg-green-500/15',   text: 'text-green-400',   border: 'border-green-500/30',   hex: '#4ade80' },
  { id: 'emerald', bg: 'bg-emerald-500/15', text: 'text-emerald-400', border: 'border-emerald-500/30', hex: '#34d399' },
  { id: 'teal',    bg: 'bg-teal-500/15',    text: 'text-teal-400',    border: 'border-teal-500/30',    hex: '#2dd4bf' },
  { id: 'cyan',    bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    border: 'border-cyan-500/30',    hex: '#22d3ee' },
  { id: 'sky',     bg: 'bg-sky-500/15',     text: 'text-sky-400',     border: 'border-sky-500/30',     hex: '#38bdf8' },
  { id: 'blue',    bg: 'bg-blue-500/15',    text: 'text-blue-400',    border: 'border-blue-500/30',    hex: '#60a5fa' },
  { id: 'indigo',  bg: 'bg-indigo-500/15',  text: 'text-indigo-400',  border: 'border-indigo-500/30',  hex: '#818cf8' },
  { id: 'violet',  bg: 'bg-violet-500/15',  text: 'text-violet-400',  border: 'border-violet-500/30',  hex: '#a78bfa' },
  { id: 'purple',  bg: 'bg-purple-500/15',  text: 'text-purple-400',  border: 'border-purple-500/30',  hex: '#c084fc' },
  { id: 'fuchsia', bg: 'bg-fuchsia-500/15', text: 'text-fuchsia-400', border: 'border-fuchsia-500/30', hex: '#e879f9' },
  { id: 'pink',    bg: 'bg-pink-500/15',    text: 'text-pink-400',    border: 'border-pink-500/30',    hex: '#f472b6' },
  { id: 'rose',    bg: 'bg-rose-500/15',    text: 'text-rose-400',    border: 'border-rose-500/30',    hex: '#fb7185' },
  // Deeper/richer variants
  { id: 'red-d',     bg: 'bg-red-600/20',     text: 'text-red-300',     border: 'border-red-600/30',     hex: '#ef4444' },
  { id: 'orange-d',  bg: 'bg-orange-600/20',  text: 'text-orange-300',  border: 'border-orange-600/30',  hex: '#ea580c' },
  { id: 'amber-d',   bg: 'bg-amber-600/20',   text: 'text-amber-300',   border: 'border-amber-600/30',   hex: '#d97706' },
  { id: 'green-d',   bg: 'bg-green-600/20',   text: 'text-green-300',   border: 'border-green-600/30',   hex: '#16a34a' },
  { id: 'teal-d',    bg: 'bg-teal-600/20',    text: 'text-teal-300',    border: 'border-teal-600/30',    hex: '#0d9488' },
  { id: 'blue-d',    bg: 'bg-blue-600/20',    text: 'text-blue-300',    border: 'border-blue-600/30',    hex: '#2563eb' },
  { id: 'indigo-d',  bg: 'bg-indigo-600/20',  text: 'text-indigo-300',  border: 'border-indigo-600/30',  hex: '#4f46e5' },
  { id: 'violet-d',  bg: 'bg-violet-600/20',  text: 'text-violet-300',  border: 'border-violet-600/30',  hex: '#7c3aed' },
  { id: 'purple-d',  bg: 'bg-purple-600/20',  text: 'text-purple-300',  border: 'border-purple-600/30',  hex: '#9333ea' },
  { id: 'pink-d',    bg: 'bg-pink-600/20',    text: 'text-pink-300',    border: 'border-pink-600/30',    hex: '#db2777' },
  { id: 'rose-d',    bg: 'bg-rose-600/20',    text: 'text-rose-300',    border: 'border-rose-600/30',    hex: '#e11d48' },
  { id: 'sky-d',     bg: 'bg-sky-600/20',     text: 'text-sky-300',     border: 'border-sky-600/30',     hex: '#0284c7' },
  { id: 'cyan-d',    bg: 'bg-cyan-600/20',    text: 'text-cyan-300',    border: 'border-cyan-600/30',    hex: '#0891b2' },
  { id: 'lime-d',    bg: 'bg-lime-600/20',    text: 'text-lime-300',    border: 'border-lime-600/30',    hex: '#65a30d' },
  { id: 'emerald-d', bg: 'bg-emerald-600/20', text: 'text-emerald-300', border: 'border-emerald-600/30', hex: '#059669' },
] as const;

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

const EMOJI_OPTIONS = [
  '💭', '💡', '❤️', '💸', '🔥', '💪', '🎯', '😴',
  '🏃', '📖', '✈️', '🙏', '🎵', '😊', '⚡', '💧',
  '🥗', '☕', '🧘', '🎨', '📝', '⭐', '🌙', '🌿',
  '🏠', '🚗', '🛒', '💊', '👶', '🐾', '🎮', '💻',
  '🎤', '🎧', '🌍', '📈', '🕐', '🏆', '📚', '🧠',
  '🌸', '🍎', '🏋️', '🧪', '🔐', '📊', '🎉', '🌊',
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
  const color = colorFromId(selectedColor);

  return (
    <div className="fixed inset-0 z-[70] flex items-end">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div
        className="relative w-full rounded-t-2xl bg-background px-4 pt-4 shadow-2xl"
        style={{ paddingBottom: 'calc(max(var(--bottom-inset, 0px), 16px) + 1rem)', maxHeight: '85vh', overflowY: 'auto' }}
      >
        {/* Handle */}
        <div className="mb-4 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        {/* Preview */}
        <div className="mb-5 flex items-center gap-3">
          <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-xl', color.bg, color.border)}>
            {selectedEmoji}
          </div>
          <input
            type="text"
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="Назва категорії"
            className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-ring"
            autoFocus
          />
        </div>

        {/* Color picker */}
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Колір</p>
        <div className="mb-5 grid grid-cols-9 gap-2">
          {COLOR_PALETTE.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedColor(c.id)}
              className={cn(
                'h-7 w-7 rounded-full transition-all',
                selectedColor === c.id && 'ring-2 ring-offset-2 ring-white/60 scale-110'
              )}
              style={{ backgroundColor: c.hex }}
              aria-label={c.id}
            />
          ))}
        </div>

        {/* Emoji picker */}
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Емодзі</p>
        <div className="mb-5 grid grid-cols-8 gap-2">
          {EMOJI_OPTIONS.map(emoji => (
            <button
              key={emoji}
              onClick={() => setSelectedEmoji(emoji)}
              className={cn(
                'flex h-10 w-full items-center justify-center rounded-xl border text-xl transition-all',
                selectedEmoji === emoji
                  ? cn(color.bg, color.border, 'ring-1 ring-offset-1')
                  : 'border-border/40 bg-muted/30 hover:bg-muted/60'
              )}
            >
              {emoji}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-full border border-border py-3 text-sm font-medium text-muted-foreground">Скасувати</button>
          <button
            onClick={() => {
              const name = initialName.toLowerCase().replace(/\s+/g, '_');
              onConfirm(name, label.trim() || name, selectedColor, selectedEmoji);
            }}
            disabled={!label.trim()}
            className={cn('flex-1 rounded-full py-3 text-sm font-semibold transition-all disabled:opacity-40', color.bg, color.text, 'border', color.border)}
          >
            Додати
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
