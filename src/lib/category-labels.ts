/**
 * Category names in the reader's language.
 *
 * Built-in categories (food, sleep, thoughts…) are stored with a Ukrainian or English label, so the
 * stored label alone showed Ukrainian to everyone. A built-in shows in the reader's language unless
 * its stored label was changed by the user, in which case the user's own name wins. Categories the
 * user or the AI created keep their stored label as typed.
 *
 * Pure TypeScript with no imports. Mirrored byte for byte in mobile/src/lib/category-labels.ts
 * (src/__tests__/category-labels.test.ts checks).
 */

type Names = { en: string; uk: string };

export const BUILTIN_CATEGORY_LABELS: Record<string, Names> = {
  thoughts: { en: 'Thoughts', uk: 'Думки' },
  thought: { en: 'Thought', uk: 'Думка' },
  ideas: { en: 'Ideas', uk: 'Ідеї' },
  feelings: { en: 'Feelings', uk: 'Почуття' },
  feeling: { en: 'Feeling', uk: 'Почуття' },
  expenses: { en: 'Expenses', uk: 'Витрати' },
  money: { en: 'Money', uk: 'Гроші' },
  finance: { en: 'Finance', uk: 'Фінанси' },
  calories: { en: 'Calories', uk: 'Калорії' },
  food: { en: 'Food', uk: 'Їжа' },
  workout: { en: 'Workout', uk: 'Тренування' },
  sport: { en: 'Sport', uk: 'Спорт' },
  goals: { en: 'Goals', uk: 'Цілі' },
  sleep: { en: 'Sleep', uk: 'Сон' },
  health: { en: 'Health', uk: "Здоров'я" },
  mood: { en: 'Mood', uk: 'Настрій' },
  dreams: { en: 'Dreams', uk: 'Сни' },
  books: { en: 'Books', uk: 'Книги' },
  work: { en: 'Work', uk: 'Робота' },
  career: { en: 'Career', uk: "Кар'єра" },
  relationships: { en: 'Relationships', uk: 'Стосунки' },
  family: { en: 'Family', uk: "Сім'я" },
  friends: { en: 'Friends', uk: 'Друзі' },
  social: { en: 'Social', uk: 'Соціальне' },
  sex_life: { en: 'Intimacy', uk: 'Інтимне' },
  travel: { en: 'Travel', uk: 'Подорожі' },
  gratitude: { en: 'Gratitude', uk: 'Вдячність' },
  music: { en: 'Music', uk: 'Музика' },
  meditation: { en: 'Meditation', uk: 'Медитація' },
  hobby: { en: 'Hobby', uk: 'Хобі' },
  nature: { en: 'Nature', uk: 'Природа' },
  art: { en: 'Art', uk: 'Мистецтво' },
  learning: { en: 'Learning', uk: 'Навчання' },
  reminder: { en: 'Reminder', uk: 'Нагадування' },
  todo: { en: 'To do', uk: 'Справи' },
  other: { en: 'Note', uk: 'Нотатка' },
  uncategorized: { en: 'No category', uk: 'Без категорії' },
};

/** Other spellings a built-in has been stored with (older seeds, the AI, the first web build). */
const KNOWN_DEFAULTS: Record<string, string[]> = {
  other: ['Other', 'Інше'],
  uncategorized: ['Uncategorized', 'Uncategorised', 'Без категорії'],
  todo: ['Todo', 'To-do', 'Задачі'],
  sex_life: ['Sex life', 'Секс'],
};

function humanize(slug: string): string {
  const s = slug.replace(/_/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : slug;
}

/** True when `stored` is one of the default names of built-in `name`, so it may be translated. */
function isDefaultLabel(name: string, stored: string): boolean {
  const own = BUILTIN_CATEGORY_LABELS[name];
  const s = stored.trim().toLowerCase();
  if (!own) return false;
  return [own.en, own.uk, ...(KNOWN_DEFAULTS[name] ?? [])].some((d) => d.toLowerCase() === s);
}

/**
 * Display name of category `name` for `locale`. `stored` is the label saved with the category
 * (label_ua) or the entry. Languages without their own built-in names use English.
 */
export function categoryLabel(name: string, locale: string, stored?: string | null): string {
  const own = BUILTIN_CATEGORY_LABELS[name];
  const kept = stored?.trim();
  if (own && (!kept || isDefaultLabel(name, kept))) return locale === 'uk' ? own.uk : own.en;
  return kept || humanize(name);
}
