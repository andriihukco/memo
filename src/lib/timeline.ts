/** Entries at or under this length, with no bot reply, read as short notes and can share a row. */
export const SHORT_NOTE_MAX = 90;

export type TimelineBlock<T> =
  | { kind: 'single'; item: T }
  | { kind: 'grid'; items: T[] };

export function isShortNote(entry: { content: string; bot_reply?: string | null }): boolean {
  return entry.content.length <= SHORT_NOTE_MAX && !entry.bot_reply;
}

/** When an entry happened: the user's chosen time if set, otherwise when it was saved. */
export function entryTime(entry: { created_at: string; metadata?: Record<string, unknown> | null }): string {
  const occurred = entry.metadata?.occurred_at;
  return typeof occurred === 'string' ? occurred : entry.created_at;
}

/**
 * Turns one day's items (already in time order) into timeline rows.
 * A run of two or more short notes becomes a grid row; anything else is a full-width row.
 */
export function layoutTimeline<T>(items: T[], isShortNote: (item: T) => boolean): TimelineBlock<T>[] {
  const blocks: TimelineBlock<T>[] = [];
  let run: T[] = [];

  const flush = () => {
    if (run.length === 1) blocks.push({ kind: 'single', item: run[0] });
    else if (run.length > 1) blocks.push({ kind: 'grid', items: run });
    run = [];
  };

  for (const item of items) {
    if (isShortNote(item)) {
      run.push(item);
    } else {
      flush();
      blocks.push({ kind: 'single', item });
    }
  }
  flush();
  return blocks;
}
