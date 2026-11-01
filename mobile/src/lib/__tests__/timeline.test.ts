import { describe, expect, it } from 'vitest';
import { layoutTimeline } from '../timeline';
import type { Entry } from '../api';

const entry = (id: string, content: string, bot_reply: string | null = null): Entry => ({
  id,
  content,
  category: 'thought',
  metadata: null,
  bot_reply,
  thread_id: null,
  reply_to_entry_id: null,
  created_at: '2026-01-01T10:00:00Z',
});

describe('layoutTimeline', () => {
  it('keeps a single short note as a card', () => {
    expect(layoutTimeline([entry('a', 'short')])).toEqual([{ kind: 'card', entry: entry('a', 'short') }]);
  });

  it('groups consecutive short notes into one grid row', () => {
    const blocks = layoutTimeline([entry('a', 'one'), entry('b', 'two'), entry('c', 'three')]);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('grid');
    expect(blocks[0].kind === 'grid' && blocks[0].entries.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });

  it('breaks a grid run at a long entry or an entry with a bot reply', () => {
    const long = entry('long', 'x'.repeat(200));
    const replied = entry('replied', 'hi', 'bot says hi');
    const blocks = layoutTimeline([entry('a', 'one'), entry('b', 'two'), long, replied, entry('c', 'three')]);
    expect(blocks.map((b) => b.kind)).toEqual(['grid', 'card', 'card', 'card']);
  });
});
