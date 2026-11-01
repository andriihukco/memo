/**
 * Keyword-based category detection for transcribed speech.
 * Runs on-device while the user talks, so no network call is needed.
 * Latin + Cyrillic (Ukrainian/Russian) stems; matched as substrings of lowercased text.
 */

export type AutoCategory = 'reminder' | 'todo' | 'feeling' | 'thought' | 'other';

export interface CategoryMatch {
  category: AutoCategory;
  score: number;
}

const KEYWORDS: Record<Exclude<AutoCategory, 'other'>, string[]> = {
  reminder: ['remind', 'reminder', 'remember to', 'don\'t forget', 'нагад', 'не забу', 'не забудь', 'будильник', 'о ', 'at 5', 'tomorrow', 'завтра'],
  todo: ['todo', 'to do', 'task', 'buy ', 'need to', 'have to', 'should ', 'купити', 'зробити', 'треба', 'потрібно'],
  feeling: ['feel', 'felt', 'happy', 'sad', 'anxious', 'tired', 'angry', 'grateful', 'відчуваю', 'відчув', 'сумно', 'радію', 'втомл', 'злий', 'вдячн', 'тривож'],
  thought: ['think', 'thought', 'idea', 'maybe', 'wonder', 'what if', 'думаю', 'думка', 'ідея', 'можливо', 'цікаво'],
};

/** Returns the best-scoring category, or 'other' when nothing matches. Ties go to the earlier key. */
export function detectCategory(text: string): CategoryMatch {
  const haystack = ` ${text.toLowerCase()} `;
  let best: CategoryMatch = { category: 'other', score: 0 };

  for (const [category, words] of Object.entries(KEYWORDS) as [Exclude<AutoCategory, 'other'>, string[]][]) {
    const score = words.reduce((n, w) => (haystack.includes(w) ? n + 1 : n), 0);
    if (score > best.score) best = { category, score };
  }
  return best;
}
