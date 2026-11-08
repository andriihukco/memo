'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n/context';
import { useAuth } from '@/lib/supabase/auth-context';
import type { AutoCategory } from '@/lib/auto-category';
import { isHexColor, swatchFor } from '@/lib/category-config';
import { AttachmentBar, useVoiceNote, type Attachment } from './attachments';

interface ComposeCtx {
  /** Opens the composer, optionally with text already typed (a quick-log prompt). */
  open(seed?: string): void;
  close(): void;
  isOpen: boolean;
  hasDraft: boolean;
  /** Text to start with on the next open; read once by the drawer. */
  seed: string | null;
  clearSeed(): void;
}

const Ctx = createContext<ComposeCtx | null>(null);

/** Fired after an entry is saved so the feed can reload. */
export const ENTRIES_CHANGED_EVENT = 'memo:entries-changed';

const CATEGORIES: AutoCategory[] = ['reminder', 'todo', 'feeling', 'thought', 'other'];
const REPEATS = ['none', 'daily', 'weekly'] as const;
type Repeat = (typeof REPEATS)[number];
/** Small grace so "now" picked a moment ago still counts as now. */
const PAST_GRACE_MS = 60_000;

export function useCompose(): ComposeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCompose must be used inside ComposeProvider');
  return c;
}

function readDraft(): boolean {
  try {
    return !!localStorage.getItem('memo:draft');
  } catch {
    return false;
  }
}

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  const open = useCallback((text?: string) => {
    setSeed(typeof text === 'string' ? text : null);
    setOpen(true);
  }, []);
  const close = useCallback(() => setOpen(false), []);
  const clearSeed = useCallback(() => setSeed(null), []);

  useEffect(() => setHasDraft(readDraft()), [isOpen]);

  const value = useMemo(() => ({ open, close, isOpen, hasDraft, seed, clearSeed }), [open, close, isOpen, hasDraft, seed, clearSeed]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <ComposeDrawer />
    </Ctx.Provider>
  );
}

/** Local date-time as the value a datetime-local input expects. */
function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ComposeDrawer() {
  const { t } = useI18n();
  const { accessToken } = useAuth();
  const { isOpen, close, seed, clearSeed } = useCompose();

  const [text, setText] = useState('');
  const [picked, setPicked] = useState<string | null>(null);
  const [userCats, setUserCats] = useState<{ name: string; label_ua: string; color: string }[]>([]);
  const [when, setWhen] = useState(() => toLocalInput(new Date()));
  const [whenSet, setWhenSet] = useState(false);
  const [remind, setRemind] = useState(false);
  const [remindAt, setRemindAt] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60_000)));
  const [repeat, setRepeat] = useState<Repeat>('none');
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [quote, setQuote] = useState(false);
  const [sticker, setSticker] = useState<string | null>(null);

  // A voice note is saved as soon as recording stops: the audio route transcribes and files it.
  const voice = useVoiceNote(async (blob, seconds) => {
    if (!accessToken) return;
    setSaving(true);
    setNote(null);
    try {
      const form = new FormData();
      form.append('file', blob, 'note.webm');
      form.append('duration_s', String(seconds));
      const res = await fetch('/api/entries/audio', { method: 'POST', headers: { Authorization: `Bearer ${accessToken}` }, body: form });
      if (!res.ok) throw new Error(t('timeline.error'));
      window.dispatchEvent(new Event(ENTRIES_CHANGED_EVENT));
      resetAndClose();
    } catch (err) {
      setNote(err instanceof Error ? err.message : t('timeline.error'));
    } finally {
      setSaving(false);
    }
  });

  // Refresh the user's categories each time the drawer opens, so new ones show up without a reload
  useEffect(() => {
    if (!isOpen || !accessToken) return;
    fetch('/api/categories', { headers: { Authorization: `Bearer ${accessToken}` } })
      .then((r) => r.json())
      .then((d: { categories?: { name: string; label_ua: string; color: string }[] }) =>
        setUserCats((d.categories ?? []).filter((c) => c.name !== 'uncategorized')),
      )
      .catch(() => {});
  }, [isOpen, accessToken]);

  // A quick-log prompt starts the text; the cursor lands after it.
  useEffect(() => {
    if (!isOpen || seed === null) return;
    setText(seed);
    clearSeed();
  }, [isOpen, seed, clearSeed]);

  const fullText = text.trim();
  // No pick means Auto: the server chooses the category, as the bot does.
  const category = picked;

  const musicReady = attachment?.kind !== 'music' || /^https?:\/\/\S+$/i.test(attachment.url.trim());
  const canSave = (!!fullText || !!attachment) && musicReady && !(quote && !fullText);

  const save = async () => {
    if (!canSave || saving || !accessToken) return;
    const remindDate = new Date(remindAt);
    if (remind && remindDate.getTime() < Date.now() - PAST_GRACE_MS) {
      setNote(t('compose.error_past'));
      return;
    }
    setSaving(true);
    setNote(null);
    const auth = { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' };
    try {
      const metadata: Record<string, unknown> = {
        ...(whenSet ? { occurred_at: new Date(when).toISOString() } : {}),
        ...(quote ? { kind: 'quote' } : {}),
        ...(sticker ? { sticker } : {}),
        // Marks an entry that carries media, so a caption is never read as a correction.
        ...(attachment ? { attachment: attachment.kind } : {}),
      };
      // Text is optional with an attachment: the title, the link or the kind stands in.
      const content =
        fullText ||
        (attachment?.kind === 'music' ? attachment.title.trim() || attachment.url.trim() : attachment ? t(`timeline.${attachment.kind}`) : '');
      const res = await fetch('/api/entries', {
        method: 'POST',
        headers: auth,
        // Only a category the user picked is sent; otherwise the server classifies it like the bot does.
        body: JSON.stringify({ content, ...(picked ? { category: picked } : {}), ...(Object.keys(metadata).length ? { metadata } : {}) }),
      });
      if (res.status === 409) throw new Error(t('compose.error_correction'));
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? t('compose.error_save'));
      const { entry } = (await res.json()) as { entry: { id: string } };

      // The entry exists first, then the file or link is attached, so a failed upload leaves no orphan file.
      if (attachment) {
        const body: BodyInit =
          attachment.kind === 'music'
            ? JSON.stringify({ kind: 'music', url: attachment.url.trim() })
            : (() => {
                const form = new FormData();
                form.append('kind', attachment.kind);
                form.append('file', attachment.file);
                return form;
              })();
        const media = await fetch(`/api/entries/${entry.id}/media`, {
          method: 'POST',
          headers: attachment.kind === 'music' ? auth : { Authorization: `Bearer ${accessToken}` },
          body,
        });
        if (!media.ok) throw new Error(t('compose.error_attach'));
      }

      if (remind) {
        const rem = await fetch('/api/reminders', {
          method: 'POST',
          headers: auth,
          body: JSON.stringify({ text: fullText, remind_at: remindDate.toISOString(), repeat }),
        });
        if (!rem.ok) throw new Error((await rem.json().catch(() => ({}))).error ?? t('compose.error_save'));
      }

      window.dispatchEvent(new Event(ENTRIES_CHANGED_EVENT));
      resetAndClose();
    } catch (err) {
      setNote(err instanceof Error ? err.message : t('compose.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const resetAndClose = () => {
    setText('');
    setPicked(null);
    setWhen(toLocalInput(new Date()));
    setWhenSet(false);
    setRemind(false);
    setRepeat('none');
    setNote(null);
    setAttachment(null);
    setQuote(false);
    setSticker(null);
    close();
  };

  return (
    <Drawer open={isOpen} onOpenChange={(o) => !o && close()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('compose.title')}</DrawerTitle>
        </DrawerHeader>

        <div className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto px-4 pb-2">
          <Textarea
            aria-label={quote ? t('timeline.quoteText') : t('compose.placeholder')}
            placeholder={quote ? t('timeline.quoteText') : t('compose.placeholder')}
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            className={quote ? 'border-l-4 border-l-primary text-base italic' : 'text-base'}
          />

          <AttachmentBar
            t={t}
            attachment={attachment}
            onAttachment={setAttachment}
            quote={quote}
            onQuote={setQuote}
            sticker={sticker}
            onSticker={setSticker}
            voice={voice}
            disabled={saving}
          />

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('compose.category')}</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant={picked === null ? 'default' : 'secondary'}
                className="min-h-11 rounded-full"
                onClick={() => setPicked(null)}
                aria-pressed={picked === null}
              >
                {t('compose.cat.auto')}
              </Button>
              {CATEGORIES.map((c) => (
                <Button
                  key={c}
                  size="sm"
                  variant={category === c ? 'default' : 'secondary'}
                  className="min-h-11 rounded-full"
                  onClick={() => setPicked(c)}
                  aria-pressed={category === c}
                >
                  {t(`compose.cat.${c}`)}
                </Button>
              ))}
              {userCats.map((c) => (
                <Button
                  key={c.name}
                  size="sm"
                  variant={category === c.name ? 'default' : 'secondary'}
                  className="min-h-11 gap-2 rounded-full"
                  onClick={() => setPicked(c.name)}
                  aria-pressed={category === c.name}
                >
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: isHexColor(c.color) ? c.color : swatchFor(c.name) }}
                    aria-hidden
                  />
                  {c.label_ua}
                </Button>
              ))}
            </div>
            {!picked && <p className="text-xs text-muted-foreground">{t('compose.hint_auto')}</p>}
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('compose.when_section')}</h3>
            <label className="flex items-center justify-between gap-3 rounded-xl bg-card px-4 py-3">
              <span className="text-sm">{t('compose.when')}</span>
              <Input
                type="datetime-local"
                value={when}
                onChange={(e) => { setWhen(e.target.value); setWhenSet(true); }}
                className="w-auto border-0 bg-transparent text-right text-base shadow-none"
                aria-label={t('compose.when')}
              />
            </label>
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{t('compose.reminder_section')}</h3>
            <div className="flex flex-col rounded-xl bg-card">
              <label className="flex min-h-11 items-center justify-between gap-3 px-4 py-3">
                <span className="text-sm">{t('compose.remind')}</span>
                <Switch checked={remind} onCheckedChange={setRemind} aria-label={t('compose.remind')} />
              </label>
              {remind && (
                <div className="flex flex-col gap-3 border-t border-border/40 px-4 py-3">
                  <label className="flex items-center justify-between gap-3">
                    <span className="text-sm">{t('compose.remind_at')}</span>
                    <Input
                      type="datetime-local"
                      value={remindAt}
                      onChange={(e) => setRemindAt(e.target.value)}
                      className="w-auto border-0 bg-transparent text-right text-base shadow-none"
                      aria-label={t('compose.remind_at')}
                    />
                  </label>
                  <div className="flex flex-col gap-2">
                    <span className="text-sm">{t('compose.repeat')}</span>
                    <div className="flex flex-wrap gap-2">
                      {REPEATS.map((r) => (
                        <Button
                          key={r}
                          size="sm"
                          variant={repeat === r ? 'default' : 'secondary'}
                          className="min-h-11 rounded-full"
                          onClick={() => setRepeat(r)}
                          aria-pressed={repeat === r}
                        >
                          {t(`compose.repeat.${r}`)}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          {note && <p role="alert" className="text-center text-sm text-destructive">{note}</p>}
        </div>

        <DrawerFooter>
          <Button className="min-h-11" onClick={() => void save()} disabled={!canSave || saving || voice.recording || !accessToken}>
            {saving ? t('compose.saving') : t('compose.save')}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
