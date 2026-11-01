import { detectCategory, type AutoCategory } from './auto-category';

export interface CategoryMeta {
  label: string;
  /** Tint used as a dot and a soft background, from the Apple system palette. */
  color: string;
  icon: string;
}

/**
 * Colours a user can give a category. Mirrors CATEGORY_SWATCHES in
 * src/lib/category-config.ts on the web: keep the two lists in sync.
 */
export const CATEGORY_SWATCHES = [
  '#FF453A', '#FF9F0A', '#FFD60A', '#30D158', '#66D4CF', '#40C8E0',
  '#0A84FF', '#5E5CE6', '#BF5AF2', '#FF375F', '#AC8E68', '#8E8E93',
] as const;

const HEX = /^#[0-9a-f]{6}$/i;

export const isHexColor = (value: unknown): value is string =>
  typeof value === 'string' && HEX.test(value);

/** Stable swatch for a slug, so a category keeps its colour without a stored choice. */
export function swatchFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CATEGORY_SWATCHES[h % CATEGORY_SWATCHES.length];
}

/** Built-in look for the categories the app detects on its own. */
export const AUTO_META: Record<AutoCategory, CategoryMeta> = {
  reminder: { label: 'Reminder', color: '#FF9F0A', icon: 'bell' },
  todo: { label: 'To do', color: '#0A84FF', icon: 'checkmark.circle' },
  feeling: { label: 'Feeling', color: '#FF375F', icon: 'heart' },
  thought: { label: 'Thought', color: '#BF5AF2', icon: 'lightbulb' },
  other: { label: 'Note', color: '#8E8E93', icon: 'note.text' },
};

const FALLBACK: CategoryMeta = { label: 'Note', color: '#8E8E93', icon: 'note.text' };

/**
 * Meta for any stored category: built-in when known, otherwise the user's own
 * colour (or a stable swatch for rows saved before colours existed).
 */
export function metaFor(category: string, serverLabel?: string, serverColor?: string): CategoryMeta {
  if (category in AUTO_META) {
    const known = AUTO_META[category as AutoCategory];
    return { ...known, label: serverLabel ?? known.label };
  }
  if (category === 'uncategorized') return { ...FALLBACK, label: serverLabel ?? 'Uncategorised' };
  return {
    label: serverLabel ?? category,
    color: isHexColor(serverColor) ? serverColor : swatchFor(category),
    icon: 'tag',
  };
}

/** Category the text belongs to, used when the user does not pick one. */
export function suggestCategory(text: string): AutoCategory {
  return detectCategory(text).category;
}
