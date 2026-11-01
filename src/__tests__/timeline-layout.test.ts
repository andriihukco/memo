import { describe, expect, it } from 'vitest';
import { entryTime, layoutTimeline } from '@/lib/timeline';

const short = (id: string) => ({ id, content: 'short note', bot_reply: null as string | null });
const long = (id: string) => ({ id, content: 'x'.repeat(200), bot_reply: null as string | null });
const isShort = (e: { content: string; bot_reply: string | null }) => e.content.length <= 90 && !e.bot_reply;

describe('layoutTimeline', () => {
  it('keeps a lone short note as a single row', () => {
    expect(layoutTimeline([short('a')], isShort)).toEqual([{ kind: 'single', item: short('a') }]);
  });

  it('groups consecutive short notes into one grid row', () => {
    const blocks = layoutTimeline([short('a'), short('b'), short('c')], isShort);
    expect(blocks).toHaveLength(1);
    expect(blocks[0].kind).toBe('grid');
  });

  it('breaks a grid run at a long entry or an entry with a bot reply', () => {
    const replied = { id: 'r', content: 'hi', bot_reply: 'hello' };
    const blocks = layoutTimeline([short('a'), short('b'), long('l'), replied, short('c')], isShort);
    expect(blocks.map((b) => b.kind)).toEqual(['grid', 'single', 'single', 'single']);
  });
});

describe('entryTime', () => {
  it('prefers the user-chosen occurred_at over created_at', () => {
    expect(entryTime({ created_at: '2026-01-02T10:00:00Z', metadata: { occurred_at: '2026-01-01T08:00:00Z' } }))
      .toBe('2026-01-01T08:00:00Z');
  });

  it('falls back to created_at when no time was chosen', () => {
    expect(entryTime({ created_at: '2026-01-02T10:00:00Z', metadata: null })).toBe('2026-01-02T10:00:00Z');
  });
});
