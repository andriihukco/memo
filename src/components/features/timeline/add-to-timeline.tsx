'use client';

import { useRef, useState } from 'react';
import { Mic, Music2, Image as ImageIcon, Quote, Smile, Square, Video, X } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { cn } from '@/lib/utils';

type Tab = 'photo' | 'video' | 'music' | 'audio' | 'quote' | 'sticker';
const STICKERS = ['🌿', '☀️', '🌙', '⭐', '💧', '🔥', '🎯', '📚', '🏃', '☕', '🎵', '💛'];
const MAX_AUDIO_S = 120;

const TABS: { id: Tab; labelKey: string; icon: typeof ImageIcon }[] = [
  { id: 'photo', labelKey: 'timeline.photo', icon: ImageIcon },
  { id: 'video', labelKey: 'timeline.video', icon: Video },
  { id: 'music', labelKey: 'timeline.music', icon: Music2 },
  { id: 'audio', labelKey: 'timeline.audio', icon: Mic },
  { id: 'quote', labelKey: 'timeline.quote', icon: Quote },
  { id: 'sticker', labelKey: 'timeline.sticker', icon: Smile },
];

/** Create an entry with an optional attachment. Mirrors the bot's and the API's own rules. */
async function createEntry(token: string, content: string, metadata: Record<string, unknown>): Promise<string> {
  const res = await fetch('/api/entries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ content, metadata }),
  });
  if (!res.ok) throw new Error('create');
  const data = (await res.json()) as { entry: { id: string } };
  return data.entry.id;
}

async function attach(token: string, entryId: string, body: FormData | { kind: 'music'; url: string }): Promise<void> {
  const init: RequestInit = { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: body instanceof FormData ? body : JSON.stringify(body) };
  if (!(body instanceof FormData)) (init.headers as Record<string, string>)['Content-Type'] = 'application/json';
  const res = await fetch(`/api/entries/${entryId}/media`, init);
  if (!res.ok) throw new Error('attach');
}

/**
 * The add sheet for the Journal: photo, video, music link, audio note, quote and sticker. Each tab
 * creates the entry first, then attaches the file or link, so a failed upload leaves no orphan file.
 */
export function AddToTimeline({ accessToken, onSaved }: { accessToken: string | null; onSaved: () => void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('photo');
  const [text, setText] = useState('');
  const [title, setTitle] = useState('');
  const [link, setLink] = useState('');
  const [sticker, setSticker] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<number | null>(null);

  const reset = () => {
    setText(''); setTitle(''); setLink(''); setSticker(null); setFile(null); setError(null);
  };

  async function save(run: (token: string) => Promise<void>) {
    if (!accessToken) return;
    setBusy(true);
    setError(null);
    try {
      await run(accessToken);
      reset();
      setOpen(false);
      onSaved();
    } catch {
      setError(t('timeline.error'));
    } finally {
      setBusy(false);
    }
  }

  const saveFile = (kind: 'photo' | 'video') => save(async (token) => {
    if (!file) throw new Error('no file');
    const id = await createEntry(token, text.trim() || t(`timeline.${kind}`), sticker ? { sticker } : {});
    const form = new FormData();
    form.append('kind', kind);
    form.append('file', file);
    await attach(token, id, form);
  });

  const saveMusic = () => save(async (token) => {
    const id = await createEntry(token, title.trim() || link.trim(), sticker ? { sticker } : {});
    await attach(token, id, { kind: 'music', url: link.trim() });
  });

  const saveQuote = () => save(async (token) => {
    await createEntry(token, text.trim(), { kind: 'quote', ...(sticker ? { sticker } : {}) });
  });

  const saveSticker = () => save(async (token) => {
    await createEntry(token, text.trim(), { sticker: sticker ?? STICKERS[0] });
  });

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : '';
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
      rec.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        if (timer.current) window.clearInterval(timer.current);
        const blob = new Blob(chunks.current, { type: rec.mimeType || 'audio/webm' });
        const duration = seconds;
        void save(async (token) => {
          // The audio route classifies the recording and saves the entries itself, so nothing is created here.
          const form = new FormData();
          form.append('file', blob, 'note.webm');
          form.append('duration_s', String(Math.min(duration, MAX_AUDIO_S)));
          const res = await fetch('/api/entries/audio', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
          if (!res.ok) throw new Error('audio');
        });
      };
      rec.start();
      recorder.current = rec;
      setSeconds(0);
      setRecording(true);
      timer.current = window.setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_AUDIO_S) recorder.current?.stop();
          return s + 1;
        });
      }, 1000);
    } catch {
      setError(t('timeline.error'));
    }
  }

  function stopRecording() {
    recorder.current?.stop();
    setRecording(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground"
      >
        {t('timeline.add')}
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/20 p-3 sm:items-center" role="dialog" aria-modal="true" aria-label={t('timeline.add')}>
          <div className="w-full max-w-md rounded-3xl bg-background p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="title-2">{t('timeline.add')}</p>
              <button type="button" onClick={() => { setOpen(false); reset(); }} aria-label={t('timeline.close')} className="grid size-11 place-items-center rounded-full bg-muted">
                <X className="size-4" aria-hidden />
              </button>
            </div>

            <div role="tablist" className="mt-4 grid grid-cols-6 gap-1 rounded-2xl bg-muted p-1">
              {TABS.map(({ id, labelKey, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => { setTab(id); setError(null); }}
                  className={cn('flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-xl caption-5', tab === id ? 'bg-background shadow-sm' : 'text-muted-foreground')}
                >
                  <Icon className="size-4" aria-hidden />
                  {t(labelKey)}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-col gap-3">
              {(tab === 'photo' || tab === 'video') ? (
                <>
                  <label className="flex min-h-11 cursor-pointer items-center justify-center rounded-2xl border border-dashed border-foreground/25 px-4 text-sm">
                    <input type="file" accept={tab === 'photo' ? 'image/*' : 'video/*'} className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
                    {file ? file.name : t('timeline.pickFile')}
                  </label>
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('timeline.caption')} className="min-h-11 rounded-2xl border bg-background px-4 text-base" />
                  <StickerRow value={sticker} onChange={setSticker} />
                  <button type="button" disabled={busy || !file} onClick={() => void saveFile(tab)} className="min-h-11 rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-40">
                    {busy ? t('timeline.saving') : t('timeline.save')}
                  </button>
                </>
              ) : null}

              {tab === 'music' ? (
                <>
                  <input value={link} onChange={(e) => setLink(e.target.value)} placeholder={t('timeline.musicLink')} inputMode="url" className="min-h-11 rounded-2xl border bg-background px-4 text-base" />
                  <p className="caption-5 text-muted-foreground">{t('timeline.musicHint')}</p>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('timeline.musicTitle')} className="min-h-11 rounded-2xl border bg-background px-4 text-base" />
                  <button type="button" disabled={busy || !link.trim()} onClick={() => void saveMusic()} className="min-h-11 rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-40">
                    {busy ? t('timeline.saving') : t('timeline.save')}
                  </button>
                </>
              ) : null}

              {tab === 'audio' ? (
                <>
                  <p className="caption-4 text-muted-foreground">{recording ? `${t('timeline.recording')} · 0:${String(seconds).padStart(2, '0')}` : ' '}</p>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => (recording ? stopRecording() : void startRecording())}
                    className={cn('mx-auto grid size-20 place-items-center rounded-full text-primary-foreground transition-transform active:scale-[0.97]', recording ? 'bg-destructive' : 'bg-primary')}
                    aria-label={recording ? t('timeline.stop') : t('timeline.record')}
                  >
                    {recording ? <Square className="size-7" aria-hidden /> : <Mic className="size-7" aria-hidden />}
                  </button>
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('timeline.caption')} className="min-h-11 rounded-2xl border bg-background px-4 text-base" />
                </>
              ) : null}

              {tab === 'quote' ? (
                <>
                  <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t('timeline.quoteText')} rows={4} className="rounded-2xl border bg-background p-4 text-base" />
                  <StickerRow value={sticker} onChange={setSticker} />
                  <button type="button" disabled={busy || !text.trim()} onClick={() => void saveQuote()} className="min-h-11 rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-40">
                    {busy ? t('timeline.saving') : t('timeline.save')}
                  </button>
                </>
              ) : null}

              {tab === 'sticker' ? (
                <>
                  <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t('timeline.caption')} className="min-h-11 rounded-2xl border bg-background px-4 text-base" />
                  <StickerRow value={sticker} onChange={setSticker} />
                  <button type="button" disabled={busy || !text.trim()} onClick={() => void saveSticker()} className="min-h-11 rounded-full bg-primary font-semibold text-primary-foreground disabled:opacity-40">
                    {busy ? t('timeline.saving') : t('timeline.save')}
                  </button>
                </>
              ) : null}

              {error ? <p role="alert" className="caption-4 text-destructive">{error}</p> : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StickerRow({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="sticker">
      {STICKERS.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          onClick={() => onChange(value === s ? null : s)}
          className={cn('grid size-11 place-items-center rounded-2xl border text-xl', value === s ? 'border-primary bg-primary/10' : 'border-foreground/10')}
        >
          {s}
        </button>
      ))}
    </div>
  );
}
