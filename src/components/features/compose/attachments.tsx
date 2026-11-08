'use client';

import { useEffect, useRef, useState } from 'react';
import { Image as ImageIcon, Mic, Music2, Quote, Smile, Square, Video, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

/** One attachment per entry: a file from the device or a music link. */
export type Attachment =
  | { kind: 'photo' | 'video'; file: File }
  | { kind: 'music'; url: string; title: string };

export const STICKERS = ['🌿', '☀️', '🌙', '⭐', '💧', '🔥', '🎯', '📚', '🏃', '☕', '🎵', '💛'];
export const MAX_AUDIO_S = 120;

type T = (key: string, vars?: Record<string, string | number>) => string;

/**
 * Records a voice note with MediaRecorder. `onDone` gets the audio and its length; the caller
 * uploads it (the audio route transcribes and saves the entries itself).
 */
export function useVoiceNote(onDone: (blob: Blob, seconds: number) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [failed, setFailed] = useState(false);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const started = useRef(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!recording) return;
    const id = window.setInterval(() => {
      const s = Math.floor((Date.now() - started.current) / 1000);
      setSeconds(s);
      if (s >= MAX_AUDIO_S) recorder.current?.stop();
    }, 250);
    return () => window.clearInterval(id);
  }, [recording]);

  async function start() {
    setFailed(false);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        setRecording(false);
        const length = Math.min(MAX_AUDIO_S, Math.max(1, Math.round((Date.now() - started.current) / 1000)));
        done.current(new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' }), length);
      };
      started.current = Date.now();
      setSeconds(0);
      rec.start();
      recorder.current = rec;
      setRecording(true);
    } catch {
      setFailed(true);
    }
  }

  const stop = () => recorder.current?.stop();
  return { recording, seconds, failed, start, stop };
}

const ToolButton = ({ label, pressed, onClick, disabled, children }: { label: string; pressed?: boolean; onClick: () => void; disabled?: boolean; children: React.ReactNode }) => (
  <Button
    type="button"
    variant={pressed ? 'default' : 'ghost'}
    size="icon"
    className="size-11 shrink-0 rounded-full"
    aria-label={label}
    aria-pressed={pressed}
    onClick={onClick}
    disabled={disabled}
  >
    {children}
  </Button>
);

/**
 * The composer's attachment bar, after Apple Journal: photo, video, music link, voice note,
 * quote style and sticker, with a preview of what is attached.
 */
export function AttachmentBar({
  t, attachment, onAttachment, quote, onQuote, sticker, onSticker, voice, disabled,
}: {
  t: T;
  attachment: Attachment | null;
  onAttachment: (a: Attachment | null) => void;
  quote: boolean;
  onQuote: (on: boolean) => void;
  sticker: string | null;
  onSticker: (s: string | null) => void;
  voice: ReturnType<typeof useVoiceNote>;
  disabled?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [fileKind, setFileKind] = useState<'photo' | 'video'>('photo');
  const [showStickers, setShowStickers] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);

  // Thumbnail for a picked photo; released when it changes.
  useEffect(() => {
    if (attachment?.kind !== 'photo') return setPreview(null);
    const url = URL.createObjectURL(attachment.file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [attachment]);

  const pickFile = (kind: 'photo' | 'video') => {
    setFileKind(kind);
    // The input's accept list changes with the kind; open it on the next frame.
    window.requestAnimationFrame(() => fileInput.current?.click());
  };

  if (voice.recording) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-2xl bg-card px-4 py-2" role="status" aria-live="polite">
        <span className="flex items-center gap-2 text-base">
          <span className="size-2.5 animate-pulse rounded-full bg-destructive motion-reduce:animate-none" aria-hidden="true" />
          {t('timeline.recording')} · {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
        </span>
        <Button type="button" variant="destructive" className="min-h-11 gap-2 rounded-full" onClick={voice.stop}>
          <Square className="size-4" aria-hidden="true" />
          {t('timeline.stop')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <input
        ref={fileInput}
        type="file"
        accept={fileKind === 'photo' ? 'image/*' : 'video/*'}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onAttachment({ kind: fileKind, file });
          e.target.value = '';
        }}
      />

      <div className="-mx-1 flex items-center gap-1 overflow-x-auto [scrollbar-width:none]" role="toolbar" aria-label={t('compose.attach')}>
        <ToolButton label={t('timeline.photo')} pressed={attachment?.kind === 'photo'} onClick={() => pickFile('photo')} disabled={disabled}>
          <ImageIcon className="size-5" aria-hidden="true" />
        </ToolButton>
        <ToolButton label={t('timeline.video')} pressed={attachment?.kind === 'video'} onClick={() => pickFile('video')} disabled={disabled}>
          <Video className="size-5" aria-hidden="true" />
        </ToolButton>
        <ToolButton
          label={t('timeline.music')}
          pressed={attachment?.kind === 'music'}
          onClick={() => onAttachment(attachment?.kind === 'music' ? null : { kind: 'music', url: '', title: '' })}
          disabled={disabled}
        >
          <Music2 className="size-5" aria-hidden="true" />
        </ToolButton>
        <ToolButton label={t('timeline.record')} onClick={() => void voice.start()} disabled={disabled}>
          <Mic className="size-5" aria-hidden="true" />
        </ToolButton>
        <ToolButton label={t('timeline.quote')} pressed={quote} onClick={() => onQuote(!quote)} disabled={disabled}>
          <Quote className="size-5" aria-hidden="true" />
        </ToolButton>
        <ToolButton label={t('timeline.sticker')} pressed={showStickers || !!sticker} onClick={() => setShowStickers((s) => !s)} disabled={disabled}>
          {sticker ? <span className="text-xl leading-none" aria-hidden="true">{sticker}</span> : <Smile className="size-5" aria-hidden="true" />}
        </ToolButton>
      </div>

      {voice.failed ? <p role="alert" className="text-sm text-destructive">{t('compose.mic_denied')}</p> : null}

      {showStickers ? (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t('timeline.stickerPick')}>
          {STICKERS.map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={sticker === s}
              onClick={() => onSticker(sticker === s ? null : s)}
              className={cn(
                'grid size-11 place-items-center rounded-2xl border text-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                sticker === s ? 'border-primary bg-primary/10' : 'border-border',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      ) : null}

      {attachment?.kind === 'music' ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-card p-3">
          <Input
            value={attachment.url}
            onChange={(e) => onAttachment({ ...attachment, url: e.target.value })}
            placeholder={t('timeline.musicLink')}
            inputMode="url"
            aria-label={t('timeline.musicLink')}
            className="min-h-11 text-base"
          />
          <Input
            value={attachment.title}
            onChange={(e) => onAttachment({ ...attachment, title: e.target.value })}
            placeholder={t('timeline.musicTitle')}
            aria-label={t('timeline.musicTitle')}
            className="min-h-11 text-base"
          />
          <p className="text-xs text-muted-foreground">{t('timeline.musicHint')}</p>
        </div>
      ) : null}

      {attachment && attachment.kind !== 'music' ? (
        <div className="flex items-center gap-3 rounded-2xl bg-card p-2 pr-1">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element -- local object URL preview
            <img src={preview} alt="" className="size-12 rounded-xl object-cover" />
          ) : (
            <span className="grid size-12 place-items-center rounded-xl bg-muted" aria-hidden="true">
              <Video className="size-5 text-muted-foreground" />
            </span>
          )}
          <span className="min-w-0 flex-1 truncate text-sm">{attachment.file.name}</span>
          <Button type="button" variant="ghost" size="icon" className="size-11 shrink-0" aria-label={t('compose.remove_attachment')} onClick={() => onAttachment(null)}>
            <X className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
