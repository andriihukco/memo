import { describe, expect, it } from 'vitest';
import { detectCategory } from '../auto-category';

describe('detectCategory', () => {
  it('detects reminders in English and Ukrainian', () => {
    expect(detectCategory('Remind me to call mom tomorrow').category).toBe('reminder');
    expect(detectCategory('Не забудь про зустріч завтра').category).toBe('reminder');
  });

  it('detects feelings', () => {
    expect(detectCategory('I feel really tired today').category).toBe('feeling');
    expect(detectCategory('Сьогодні відчуваю втому').category).toBe('feeling');
  });

  it('detects thoughts and todos', () => {
    expect(detectCategory('I think we should try a new idea').category).toBe('thought');
    expect(detectCategory('Треба купити молоко').category).toBe('todo');
  });

  it('falls back to other when nothing matches', () => {
    expect(detectCategory('blue')).toEqual({ category: 'other', score: 0 });
  });
});
