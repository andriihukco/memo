import { detectCategory, type AutoCategory } from './auto-category';

export interface CategoryMeta {
  label: string;
  /** Tint used as a dot and a soft background, from the Apple system palette. */
  color: string;
  icon: string;
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

/** Meta for any stored category: built-in when known, otherwise a neutral tag. */
export function metaFor(category: string, serverLabel?: string): CategoryMeta {
  if (category in AUTO_META) {
    const known = AUTO_META[category as AutoCategory];
    return { ...known, label: serverLabel ?? known.label };
  }
  return { ...FALLBACK, label: serverLabel ?? category };
}

/** Category the text belongs to, used when the user does not pick one. */
export function suggestCategory(text: string): AutoCategory {
  return detectCategory(text).category;
}
