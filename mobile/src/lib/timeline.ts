import type { Entry } from './api';

/** Entries at or under this length, with no bot reply, read as short notes and can share a row. */
export const SHORT_NOTE_MAX = 90;

export type TimelineBlock =
  | { kind: 'card'; entry: Entry }
  | { kind: 'grid'; entries: Entry[] };

export function isShortNote(e: Entry): boolean {
  return e.content.length <= SHORT_NOTE_MAX && !e.bot_reply;
}

/**
 * Turns one day's entries (already in time order) into timeline rows.
 * A run of two or more short notes becomes a two-column grid row;
 * everything else is a full-width card on the rail.
 */
export function layoutTimeline(entries: Entry[]): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];
  let run: Entry[] = [];

  const flush = () => {
    if (run.length === 1) blocks.push({ kind: 'card', entry: run[0] });
    else if (run.length > 1) blocks.push({ kind: 'grid', entries: run });
    run = [];
  };

  for (const e of entries) {
    if (isShortNote(e)) {
      run.push(e);
    } else {
      flush();
      blocks.push({ kind: 'card', entry: e });
    }
  }
  flush();
  return blocks;
}
