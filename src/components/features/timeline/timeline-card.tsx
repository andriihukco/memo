'use client';

import { Music2, Play, Quote } from 'lucide-react';
import { cn } from '@/lib/utils';

/** An attachment as the API returns it. Files carry a signed `url`; music carries `meta.url`. */
export interface MediaItem {
  id: string;
  kind: 'photo' | 'video' | 'audio' | 'music';
  url?: string | null;
  mime?: string | null;
  duration_s?: number | null;
  meta?: { url?: string; provider?: string; title?: string } | null;
}

export interface TimelineEntry {
  id: string;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  media?: MediaItem[];
}

/** Entries that get a rich card. Plain notes keep the existing feed card. */
export function isTimelineEntry(e: TimelineEntry): boolean {
  return (e.media?.length ?? 0) > 0 || e.metadata?.kind === 'quote' || typeof e.metadata?.sticker === 'string';
}

const card = 'relative overflow-hidden rounded-3xl border border-foreground/10 bg-background/70 shadow-sm backdrop-blur-xl';

/** A small emoji sticker, tilted, on the corner of a card. The user picks it when writing. */
function Sticker({ emoji }: { emoji: string }) {
  return (
    <span aria-hidden className="absolute -right-2 -top-3 z-10 grid size-12 place-items-center rounded-2xl bg-background text-2xl shadow-md" style={{ rotate: '8deg' }}>
      {emoji}
    </span>
  );
}

function PhotoCard({ entry, media }: { entry: TimelineEntry; media: MediaItem }) {
  return (
    <figure className={card}>
      {media.url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={media.url} alt={entry.content} loading="lazy" className="block w-full object-cover" />
      ) : null}
      {entry.content ? <figcaption className="body-6 px-5 py-4 text-foreground/80">{entry.content}</figcaption> : null}
      {typeof entry.metadata.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </figure>
  );
}

function VideoCard({ entry, media }: { entry: TimelineEntry; media: MediaItem }) {
  return (
    <figure className={card}>
      {media.url ? (
        <video src={media.url} controls playsInline preload="metadata" className="block w-full bg-foreground/5" />
      ) : null}
      {entry.content ? <figcaption className="body-6 px-5 py-4 text-foreground/80">{entry.content}</figcaption> : null}
      {typeof entry.metadata.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </figure>
  );
}

/** An audio note: the recording to play, and the words Memo read from it underneath. */
function AudioCard({ entry, media }: { entry: TimelineEntry; media: MediaItem }) {
  const seconds = media.duration_s ?? 0;
  return (
    <article className={cn(card, 'p-5')}>
      <div className="flex items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground" aria-hidden>
          <Play className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="caption-3 text-foreground">Audio note</p>
          <p className="caption-5 tabular-nums text-muted-foreground">{seconds ? `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` : ''}</p>
        </div>
      </div>
      {media.url ? <audio src={media.url} controls preload="metadata" className="mt-4 w-full" /> : null}
      <p className="body-6 mt-4 text-foreground/80">{entry.content}</p>
      {typeof entry.metadata.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </article>
  );
}

/** A music link: the service, the title the user wrote, and a button that opens the track. */
function MusicCard({ entry, media }: { entry: TimelineEntry; media: MediaItem }) {
  const url = media.meta?.url;
  const provider = media.meta?.provider ?? 'music';
  return (
    <article className={cn(card, 'flex items-center gap-4 p-5')}>
      <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-muted" aria-hidden>
        <Music2 className="size-6 text-foreground/70" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="caption-5 uppercase tracking-widest text-muted-foreground">{provider}</p>
        <p className="title-2 break-words text-foreground">{entry.content}</p>
      </div>
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="caption-3 shrink-0 rounded-full bg-primary px-4 py-2 text-primary-foreground">
          Open
        </a>
      ) : null}
      {typeof entry.metadata.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </article>
  );
}

/** A quote: large type, the words given room, and the time it was saved. */
function QuoteCard({ entry }: { entry: TimelineEntry }) {
  return (
    <blockquote className={cn(card, 'p-7')}>
      <Quote className="size-6 text-primary" aria-hidden />
      <p className="heading-5 mt-4 break-words text-foreground">{entry.content}</p>
      {typeof entry.metadata.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </blockquote>
  );
}

/** Note with a sticker: the text on a card, the sticker on its corner. */
function StickerNote({ entry }: { entry: TimelineEntry }) {
  return (
    <article className={cn(card, 'p-5')}>
      <p className="body-3 break-words text-foreground">{entry.content}</p>
      <Sticker emoji={String(entry.metadata.sticker)} />
    </article>
  );
}

/** Picks the right card for an entry. Returns null for plain notes, which keep the feed's own card. */
export function TimelineCard({ entry }: { entry: TimelineEntry }) {
  const first = entry.media?.[0];
  if (first?.kind === 'photo') return <PhotoCard entry={entry} media={first} />;
  if (first?.kind === 'video') return <VideoCard entry={entry} media={first} />;
  if (first?.kind === 'audio') return <AudioCard entry={entry} media={first} />;
  if (first?.kind === 'music') return <MusicCard entry={entry} media={first} />;
  if (entry.metadata.kind === 'quote') return <QuoteCard entry={entry} />;
  if (typeof entry.metadata.sticker === 'string') return <StickerNote entry={entry} />;
  return null;
}
