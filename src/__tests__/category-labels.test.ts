import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categoryLabel } from '@/lib/category-labels';

describe('categoryLabel', () => {
  it('translates a built-in stored with its default name', () => {
    expect(categoryLabel('food', 'en', 'Їжа')).toBe('Food');
    expect(categoryLabel('food', 'uk', 'Food')).toBe('Їжа');
    expect(categoryLabel('sleep', 'en', 'Сон')).toBe('Sleep');
    expect(categoryLabel('other', 'uk', 'Other')).toBe('Нотатка');
  });

  it('keeps a built-in the user renamed', () => {
    expect(categoryLabel('food', 'en', 'Їжа і кава')).toBe('Їжа і кава');
    expect(categoryLabel('sleep', 'uk', 'Night routine')).toBe('Night routine');
  });

  it('keeps categories the user or the AI created, as typed', () => {
    expect(categoryLabel('cat_x1y2', 'en', 'Садівництво')).toBe('Садівництво');
    expect(categoryLabel('book_club', 'uk', 'Book club')).toBe('Book club');
  });

  it('falls back to English for other languages and to a readable slug', () => {
    expect(categoryLabel('health', 'de', "Здоров'я")).toBe('Health');
    expect(categoryLabel('sleep', 'en')).toBe('Sleep');
    expect(categoryLabel('board_games', 'en')).toBe('Board games');
  });

  it('mobile/src/lib/category-labels.ts matches src/lib/category-labels.ts', () => {
    const root = join(__dirname, '..', '..');
    expect(readFileSync(join(root, 'mobile/src/lib/category-labels.ts'), 'utf8')).toBe(readFileSync(join(root, 'src/lib/category-labels.ts'), 'utf8'));
  });
});
