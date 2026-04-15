'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ── Category helpers (shared) ─────────────────────────────────────────────────

const KNOWN_CATEGORIES = [
  'thoughts','ideas','feelings','expenses','calories','workout',
  'dreams','relationships','health','travel','books','gratitude','goals','sleep','music',
];

const CATEGORY_LABELS_UA: Record<string, string> = {
  thoughts: 'Думки', ideas: 'Ідеї', feelings: 'Почуття',
  expenses: 'Витрати', calories: 'Калорії', workout: 'Тренування',
  dreams: 'Сни', relationships: 'Стосунки', health: "Здоров'я",
  travel: 'Подорожі', books: 'Книги', gratitude: 'Вдячність',
  goals: 'Цілі', sleep: 'Сон', music: 'Музика',
};

const CATEGORY_COLORS: Record<string, string> = {
  thoughts:      'bg-indigo-100 text-indigo-700 border-indigo-200',
  ideas:         'bg-amber-100 text-amber-700 border-amber-200',
  feelings:      'bg-pink-100 text-pink-700 border-pink-200',
  expenses:      'bg-emerald-100 text-emerald-700 border-emerald-200',
  calories:      'bg-orange-100 text-orange-700 border-orange-200',
  workout:       'bg-blue-100 text-blue-700 border-blue-200',
  dreams:        'bg-violet-100 text-violet-700 border-violet-200',
  relationships: 'bg-rose-100 text-rose-700 border-rose-200',
  health:        'bg-teal-100 text-teal-700 border-teal-200',
  travel:        'bg-cyan-100 text-cyan-700 border-cyan-200',
  books:         'bg-yellow-100 text-yellow-700 border-yellow-200',
  gratitude:     'bg-lime-100 text-lime-700 border-lime-200',
  goals:         'bg-sky-100 text-sky-700 border-sky-200',
  sleep:         'bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200',
  music:         'bg-purple-100 text-purple-700 border-purple-200',
  work:          'bg-slate-100 text-slate-700 border-slate-200',
  social:        'bg-pink-100 text-pink-700 border-pink-200',
  career:        'bg-blue-100 text-blue-700 border-blue-200',
};

// Dynamic fallback palette for unknown categories
const FALLBACK_PALETTE = [
  'bg-violet-100 text-violet-700 border-violet-200',
  'bg-teal-100 text-teal-700 border-teal-200',
  'bg-rose-100 text-rose-700 border-rose-200',
  'bg-cyan-100 text-cyan-700 border-cyan-200',
  'bg-lime-100 text-lime-700 border-lime-200',
  'bg-sky-100 text-sky-700 border-sky-200',
  'bg-amber-100 text-amber-700 border-amber-200',
  'bg-indigo-100 text-indigo-700 border-indigo-200',
];

export function getCategoryLabel(cat: string, serverLabel?: string): string {
  if (CATEGORY_LABELS_UA[cat]) return CATEGORY_LABELS_UA[cat];
  if (serverLabel) return serverLabel;
  // Capitalize first letter, replace underscores with spaces
  return cat.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export function getCategoryColor(cat: string): string {
  if (CATEGORY_COLORS[cat]) return CATEGORY_COLORS[cat];
  let h = 0; for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) & 0xffffffff;
  return FALLBACK_PALETTE[Math.abs(h) % FALLBACK_PALETTE.length];
}

// Alias — same function, kept for graph/badge usage
export const categoryBadge = getCategoryColor;

// ── EditDrawer ────────────────────────────────────────────────────────────────

interface EditEntry {
  id: string;
  content: string;
  category: string;
}

interface EditDrawerProps {
  entry: EditEntry;
  onSave: (id: string, content: string, category: string) => Promise<void>;
  onClose: () => void;
  accessToken?: string | null;
}

export function EditDrawer({ entry, onSave, onClose, accessToken }: EditDrawerProps) {
  // Support comma-separated multi-category
  const initialCats = entry.category.split(',').map(s => s.trim()).filter(Boolean);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set(initialCats));
  const [customCategory, setCustomCategory] = useState('');
  const [editContent, setEditContent] = useState(entry.content);
  const [saving, setSaving] = useState(false);
  const [userCats, setUserCats] = useState<string[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load user's custom categories
  useEffect(() => {
    if (!accessToken) return;
    fetch('/api/categories', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then(r => r.ok ? r.json() : { categories: [] })
      .then(d => {
        const names: string[] = (d.categories ?? []).map((c: { name: string }) => c.name);
        setUserCats(names.filter(n => !KNOWN_CATEGORIES.includes(n)));
      })
      .catch(() => {});
  }, [accessToken]);

  useEffect(() => {
    setTimeout(() => textareaRef.current?.focus(), 80);
  }, []);

  const toggleCat = (cat: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) { if (next.size > 1) next.delete(cat); } // keep at least one
      else next.add(cat);
      return next;
    });
  };

  const addCustom = () => {
    // Preserve original casing, just replace spaces with underscores for the key
    const raw = customCategory.trim();
    if (!raw) return;
    const cat = raw.replace(/\s+/g, '_');
    setSelectedCats((prev) => new Set([...prev, cat]));
    setCustomCategory('');
  };

  const save = async () => {
    const finalCategory = [...selectedCats].join(',');
    const finalContent = editContent.trim();
    if (!finalContent) return;
    setSaving(true);
    try {
      // Persist any new custom categories
      if (accessToken) {
        const newCats = [...selectedCats].filter(c => !KNOWN_CATEGORIES.includes(c) && !userCats.includes(c));
        for (const cat of newCats) {
          await fetch('/api/categories', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
            body: JSON.stringify({ name: cat, label: getCategoryLabel(cat) }),
          }).catch(() => {});
        }
      }
      await onSave(entry.id, finalContent, finalCategory);
      onClose();
    } finally {
      setSaving(false);
    }
  };

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

        {/* Close X */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/70"
          aria-label="Закрити"
        >
          <X size={14} />
        </button>

        {/* Category chips — multi-select */}
        <div className="mb-3 flex flex-wrap gap-1.5 pr-10">
          {KNOWN_CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                getCategoryColor(cat),
                selectedCats.has(cat) ? 'ring-2 ring-offset-1 ring-primary/50 scale-105' : 'opacity-60'
              )}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
          {/* User's custom categories from DB */}
          {userCats.map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className={cn(
                'rounded-full border px-2.5 py-1 text-xs font-medium transition-all',
                getCategoryColor(cat),
                selectedCats.has(cat) ? 'ring-2 ring-offset-1 ring-primary/50 scale-105' : 'opacity-60'
              )}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
          {/* Any selected custom cats not yet in DB */}
          {[...selectedCats].filter(c => !KNOWN_CATEGORIES.includes(c) && !userCats.includes(c)).map((cat) => (
            <button
              key={cat}
              onClick={() => toggleCat(cat)}
              className={cn('rounded-full border px-2.5 py-1 text-xs font-medium transition-all', getCategoryColor(cat), 'ring-2 ring-offset-1 ring-primary/50 scale-105')}
            >
              {getCategoryLabel(cat)}
            </button>
          ))}
        </div>

        {/* Custom category */}
        <div className="mb-3 flex gap-2">
          <input
            type="text"
            placeholder="Додати свою категорію..."
            value={customCategory}
            onChange={(e) => setCustomCategory(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom(); } }}
            className="flex-1 rounded-full border border-input bg-background px-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-ring"
          />
          {customCategory.trim() && (
            <button onClick={addCustom} className="rounded-full bg-primary px-3 py-2 text-xs font-medium text-primary-foreground">
              +
            </button>
          )}
        </div>

        {/* Content */}
        <textarea
          ref={textareaRef}
          value={editContent}
          onChange={(e) => setEditContent(e.target.value)}
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
