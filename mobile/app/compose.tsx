import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { Text, TextInput } from '../src/theme/typography';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useEntries } from '../src/lib/entry-store';
import { api, ApiError } from '../src/lib/api';
import { useSession } from '../src/lib/session';
import { AttachmentBar, useVoiceNote, type Attachment } from '../src/components/attachment-bar';
import { metaFor, AUTO_META } from '../src/lib/category-meta';
import { Chip, PrimaryButton, TOUCH } from '../src/components/ui';
import type { AutoCategory } from '../src/lib/auto-category';
import type { RepeatRule } from '../src/lib/api';
import { t, getLocale } from '../src/i18n';
import { useTheme, useThemed, type Theme } from '../src/theme/theme';
import { ScreenEnter } from '../src/motion';

const AUTO_KEYS = Object.keys(AUTO_META) as AutoCategory[];
const REPEATS: RepeatRule[] = ['none', 'daily', 'weekly'];
/** Small grace so "now" picked a moment ago still counts as now. */
const PAST_GRACE_MS = 60_000;

const stamp = (d: Date): string =>
  d.toLocaleString(getLocale(), { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type PickerKey = 'when' | 'remind';

/**
 * The one composer: text plus an attachment bar (photo, video, music, voice, quote, sticker).
 * Opened by a tap on + (empty), a quick log on Today (prefilled) or a hold on + (voice transcript).
 */
export default function ComposeScreen() {
  return (
    <ScreenEnter>
      <ComposeScreenBody />
    </ScreenEnter>
  );
}

function ComposeScreenBody() {
  const { colors, styles } = useThemed(makeStyles);
  const { scheme } = useTheme();
  const { add, categories, refresh } = useEntries();
  const { token } = useSession();
  const { text: initial } = useLocalSearchParams<{ text?: string }>();
  const [text, setText] = useState(initial ?? '');
  const [picked, setPicked] = useState<string | null>(null);
  const [when, setWhen] = useState(() => new Date());
  const [whenSet, setWhenSet] = useState(false);
  const [remind, setRemind] = useState(false);
  const [remindAt, setRemindAt] = useState(() => new Date(Date.now() + 60 * 60_000));
  const [repeat, setRepeat] = useState<RepeatRule>('none');
  const [picker, setPicker] = useState<PickerKey | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const [quote, setQuote] = useState(false);
  const [sticker, setSticker] = useState<string | null>(null);

  // A voice note is saved as soon as recording stops: the audio route transcribes and files it.
  const voice = useVoiceNote(async (file, seconds) => {
    if (!token) return;
    setSaving(true);
    setNote(null);
    try {
      await api.uploadAudio(token, file, seconds);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await refresh();
      router.back();
    } catch {
      setNote(t('timeline.error'));
    } finally {
      setSaving(false);
    }
  });

  const fullText = text.trim();
  const musicReady = attachment?.kind !== 'music' || /^https?:\/\/\S+$/i.test(attachment.url.trim());
  const canSave = (!!fullText || !!attachment) && musicReady && !(quote && !fullText);

  const onPick = (key: PickerKey) => (event: DateTimePickerEvent, date?: Date) => {
    if (Platform.OS === 'android') setPicker(null);
    if (event.type === 'dismissed' || !date) return;
    if (key === 'when') {
      setWhen(date);
      setWhenSet(true);
    } else {
      setRemindAt(date);
    }
  };

  const save = async () => {
    if (!canSave || saving) return;
    if (remind && remindAt.getTime() < Date.now() - PAST_GRACE_MS) {
      setNote(t('compose.error_past'));
      return;
    }
    setSaving(true);
    try {
      // Text is optional with an attachment: the title, the link or the kind stands in.
      const content =
        fullText ||
        (attachment?.kind === 'music' ? attachment.title.trim() || attachment.url.trim() : attachment ? t(`timeline.${attachment.kind}`) : '');
      // Only a category the user picked is sent; otherwise the server classifies it like the bot does.
      const saved = await add(content, picked ?? 'uncategorized', {
        occurredAt: whenSet ? when : undefined,
        reminder: remind ? { at: remindAt, repeat } : undefined,
        metadata: {
          ...(quote ? { kind: 'quote' } : {}),
          ...(sticker ? { sticker } : {}),
          // Marks an entry that carries media, so a caption is never read as a correction.
          ...(attachment ? { attachment: attachment.kind } : {}),
        },
      });
      // The entry exists first, then the file or link is attached, as on the web.
      if (attachment && saved && token) {
        try {
          if (attachment.kind === 'music') await api.attachMusic(token, saved.id, attachment.url.trim());
          else await api.attachFile(token, saved.id, attachment.kind, attachment.asset);
          await refresh();
        } catch {
          setNote(t('compose.error_attach'));
          return;
        }
      }
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
    } catch (e) {
      setNote(e instanceof ApiError && e.status === 409 ? t('compose.error_correction') : e instanceof Error ? e.message : t('compose.error_save'));
    } finally {
      setSaving(false);
    }
  };

  const pickerRow = (key: PickerKey, label: string, value: Date) => (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={() => setPicker(picker === key ? null : key)}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
      >
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{stamp(value)}</Text>
      </Pressable>
      {picker === key ? (
        <DateTimePicker
          value={value}
          mode="datetime"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          themeVariant={scheme}
          minimumDate={key === 'remind' ? new Date() : undefined}
          onChange={onPick(key)}
        />
      ) : null}
    </>
  );

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel={t('compose.cancel')} onPress={() => router.back()} style={styles.headerBtn}>
          <Text style={styles.cancel}>{t('compose.cancel')}</Text>
        </Pressable>
        <Text style={styles.title}>{t('compose.title')}</Text>
        <View style={styles.headerBtn} />
      </View>

      <TextInput
        multiline
        autoFocus={!initial}
        value={text}
        onChangeText={setText}
        placeholder={quote ? t('timeline.quoteText') : t('compose.placeholder')}
        placeholderTextColor={colors.muted}
        style={[styles.input, quote && styles.quote]}
        accessibilityLabel={quote ? t('timeline.quoteText') : t('compose.placeholder')}
      />

      <AttachmentBar
        attachment={attachment}
        onAttachment={setAttachment}
        quote={quote}
        onQuote={setQuote}
        sticker={sticker}
        onSticker={setSticker}
        voice={voice}
        disabled={saving}
      />

      <Text style={styles.sectionLabel}>{t('compose.category')}</Text>
      <View style={styles.chips}>
        {/* Auto: no category is sent and the server picks one, as the bot does. */}
        <Chip label={t('compose.cat.auto')} color={colors.tint} selected={picked === null} onPress={() => setPicked(null)} />
        {AUTO_KEYS.map((key) => {
          const meta = metaFor(key);
          return (
            <Chip key={key} label={meta.label} color={meta.color} selected={picked === key} onPress={() => setPicked(key)} />
          );
        })}
        {categories
          .filter((c) => c.name !== 'uncategorized')
          .map((c) => {
            const meta = metaFor(c.name, c.label_ua, c.color);
            return (
              <Chip key={c.name} label={meta.label} color={meta.color} selected={picked === c.name} onPress={() => setPicked(c.name)} />
            );
          })}
      </View>
      {!picked ? <Text style={styles.hint}>{t('compose.hint_auto')}</Text> : null}

      <Text style={styles.sectionLabel}>{t('compose.when_section')}</Text>
      <View style={styles.group}>
        {pickerRow('when', t('compose.when'), when)}
      </View>

      <Text style={styles.sectionLabel}>{t('compose.reminder_section')}</Text>
      <View style={styles.group}>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>{t('compose.remind')}</Text>
          <Switch
            value={remind}
            onValueChange={(v) => { setRemind(v); if (!v) setPicker(null); }}
            trackColor={{ false: colors.separator, true: colors.tint }}
            accessibilityLabel={t('compose.remind')}
          />
        </View>
        {remind ? (
          <>
            {pickerRow('remind', t('compose.remind_at'), remindAt)}
            <View style={styles.repeatRow}>
              <Text style={styles.rowLabel}>{t('compose.repeat')}</Text>
              <View style={styles.chips}>
                {REPEATS.map((r) => (
                  <Chip key={r} label={t(`compose.repeat.${r}`)} color={colors.tint} selected={repeat === r} onPress={() => setRepeat(r)} />
                ))}
              </View>
            </View>
          </>
        ) : null}
      </View>

      {note ? <Text style={styles.note}>{note}</Text> : null}

      <PrimaryButton
        label={saving ? t('compose.saving') : t('compose.save')}
        onPress={() => void save()}
        disabled={!canSave || saving || voice.recording}
      />
    </ScrollView>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  content: { padding: 16, gap: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBtn: { minWidth: TOUCH, minHeight: TOUCH, justifyContent: 'center' },
  cancel: { fontSize: colors.fs(17), color: colors.tint },
  title: { fontSize: colors.fs(17), fontWeight: '600', color: colors.label },
  input: {
    minHeight: 160,
    fontSize: colors.fs(20),
    lineHeight: 28,
    color: colors.label,
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 16,
    textAlignVertical: 'top',
  },
  quote: { fontStyle: 'italic', borderLeftWidth: 4, borderLeftColor: colors.tint },
  sectionLabel: { fontSize: colors.fs(13), color: colors.muted, textTransform: 'uppercase' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hint: { fontSize: colors.fs(13), color: colors.muted, marginTop: -8 },
  group: { backgroundColor: colors.card, borderRadius: 14, overflow: 'hidden' },
  row: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  rowLabel: { fontSize: colors.fs(16), color: colors.label },
  rowValue: { fontSize: colors.fs(16), color: colors.tint, fontVariant: ['tabular-nums'] },
  repeatRow: { paddingHorizontal: 16, paddingVertical: 12, gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  note: { fontSize: colors.fs(15), color: colors.destructive, textAlign: 'center' },
});
