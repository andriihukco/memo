import { useEffect, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../theme/typography';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { api } from '../lib/api';
import { haptic } from '../motion';
import { Symbol } from './symbol';
import { TOUCH } from './ui';
import { useThemed, type Theme } from '../theme/theme';

type Tab = 'photo' | 'video' | 'music' | 'audio' | 'quote' | 'sticker';
const TABS: { id: Tab; label: string; symbol: string }[] = [
  { id: 'photo', label: 'Photo', symbol: 'photo' },
  { id: 'video', label: 'Video', symbol: 'video.fill' },
  { id: 'music', label: 'Music', symbol: 'music.note' },
  { id: 'audio', label: 'Audio', symbol: 'mic.fill' },
  { id: 'quote', label: 'Quote', symbol: 'quote.opening' },
  { id: 'sticker', label: 'Sticker', symbol: 'face.smiling' },
];
const STICKERS = ['🌿', '☀️', '🌙', '⭐', '💧', '🔥', '🎯', '📚', '🏃', '☕', '🎵', '💛'];
const MAX_AUDIO_S = 120;

/**
 * Add to the timeline: photos and videos from the library, a music link, an audio note, a quote or
 * a sticker note. Files are created as an entry first, then attached, as on the web.
 */
export function AddToTimeline({ token, onSaved }: { token: string | null; onSaved: () => void }) {
  const { colors, styles } = useThemed(makeStyles);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('photo');
  const [text, setText] = useState('');
  const [link, setLink] = useState('');
  const [sticker, setSticker] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 500);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef(0);

  useEffect(() => {
    if (!recState.isRecording) return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setSeconds(s);
      if (s >= MAX_AUDIO_S) void stopRecording();
    }, 500);
    return () => clearInterval(id);
    // stopRecording is stable for the life of one recording.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recState.isRecording]);

  const reset = () => { setText(''); setLink(''); setSticker(null); setSeconds(0); };
  const close = () => { setOpen(false); reset(); };

  async function run(work: (t: string) => Promise<void>) {
    if (!token) return;
    setBusy(true);
    try {
      await work(token);
      haptic.success();
      close();
      onSaved();
    } catch {
      Alert.alert('Could not save', 'Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  async function pickFile(kind: 'photo' | 'video') {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: kind === 'photo' ? ['images'] : ['videos'],
      quality: 0.8,
      videoMaxDuration: 60,
    });
    if (res.canceled || !res.assets[0]) return;
    const asset = res.assets[0];
    await run(async (t) => {
      const entry = await api.createEntry(t, text.trim() || kind, 'uncategorized', sticker ? { sticker } : undefined);
      await api.attachFile(t, entry.entry.id, kind, {
        uri: asset.uri,
        name: asset.fileName ?? `${kind}-${Date.now()}`,
        type: asset.mimeType ?? (kind === 'photo' ? 'image/jpeg' : 'video/mp4'),
      });
    });
  }

  async function startRecording() {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Microphone', 'Allow the microphone in Settings to record audio notes.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    startedAt.current = Date.now();
    recorder.record();
  }

  async function stopRecording() {
    if (!recState.isRecording) return;
    await recorder.stop();
    const durationS = Math.min(MAX_AUDIO_S, Math.max(1, Math.round((Date.now() - startedAt.current) / 1000)));
    const uri = recorder.uri;
    await setAudioModeAsync({ allowsRecording: false });
    if (!uri) return;
    await run(async (t) => {
      await api.uploadAudio(t, { uri, name: 'note.m4a', type: 'audio/m4a' }, durationS);
    });
  }

  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel="Add to timeline" onPress={() => setOpen(true)} style={styles.addButton}>
        <Symbol name="plus" size={14} color={colors.onTint} weight="semibold" />
        <Text style={styles.addText}>Add</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
        <ScrollView contentContainerStyle={styles.sheet} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.title}>Add to timeline</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.close}>
              <Symbol name="xmark" size={14} color={colors.muted} weight="semibold" />
            </Pressable>
          </View>

          <View accessibilityRole="tablist" style={styles.tabs}>
            {TABS.map((t) => (
              <Pressable
                key={t.id}
                accessibilityRole="tab"
                accessibilityState={{ selected: tab === t.id }}
                onPress={() => setTab(t.id)}
                style={[styles.tab, tab === t.id && styles.tabOn]}
              >
                <Symbol name={t.symbol} size={16} color={tab === t.id ? colors.onTint : colors.muted} />
                <Text style={[styles.tabText, tab === t.id && styles.tabTextOn]}>{t.label}</Text>
              </Pressable>
            ))}
          </View>

          {tab === 'photo' || tab === 'video' ? (
            <View style={styles.stack}>
              <TextInput value={text} onChangeText={setText} placeholder="Caption" placeholderTextColor={colors.muted} style={styles.input} />
              <StickerRow value={sticker} onChange={setSticker} colors={colors} styles={styles} />
              <Pressable accessibilityRole="button" disabled={busy} onPress={() => void pickFile(tab)} style={styles.primary}>
                <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Choose from library'}</Text>
              </Pressable>
            </View>
          ) : null}

          {tab === 'music' ? (
            <View style={styles.stack}>
              <TextInput value={link} onChangeText={setLink} placeholder="Link to a track" placeholderTextColor={colors.muted} autoCapitalize="none" keyboardType="url" style={styles.input} />
              <TextInput value={text} onChangeText={setText} placeholder="Title" placeholderTextColor={colors.muted} style={styles.input} />
              <Text style={styles.hint}>Spotify, Apple Music, YouTube Music, YouTube or SoundCloud.</Text>
              <Pressable
                accessibilityRole="button"
                disabled={busy || !link.trim()}
                onPress={() => void run(async (t) => {
                  const entry = await api.createEntry(t, text.trim() || link.trim(), 'uncategorized');
                  await api.attachMusic(t, entry.entry.id, link.trim());
                })}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          ) : null}

          {tab === 'audio' ? (
            <View style={styles.stack}>
              <Text style={styles.hint}>{recState.isRecording ? `Recording · 0:${String(seconds).padStart(2, '0')}` : ' '}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={recState.isRecording ? 'Stop' : 'Record'}
                disabled={busy}
                onPress={() => (recState.isRecording ? void stopRecording() : void startRecording())}
                style={[styles.recordButton, recState.isRecording && styles.recordButtonOn]}
              >
                <Symbol name={recState.isRecording ? 'stop.fill' : 'mic.fill'} size={28} color={colors.onTint} />
              </Pressable>
            </View>
          ) : null}

          {tab === 'quote' ? (
            <View style={styles.stack}>
              <TextInput value={text} onChangeText={setText} placeholder="Write the quote" placeholderTextColor={colors.muted} multiline style={[styles.input, styles.multiline]} />
              <StickerRow value={sticker} onChange={setSticker} colors={colors} styles={styles} />
              <Pressable
                accessibilityRole="button"
                disabled={busy || !text.trim()}
                onPress={() => void run(async (t) => {
                  await api.createEntry(t, text.trim(), 'uncategorized', { kind: 'quote', ...(sticker ? { sticker } : {}) });
                })}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          ) : null}

          {tab === 'sticker' ? (
            <View style={styles.stack}>
              <TextInput value={text} onChangeText={setText} placeholder="A note" placeholderTextColor={colors.muted} style={styles.input} />
              <StickerRow value={sticker} onChange={setSticker} colors={colors} styles={styles} />
              <Pressable
                accessibilityRole="button"
                disabled={busy || !text.trim()}
                onPress={() => void run(async (t) => {
                  await api.createEntry(t, text.trim(), 'uncategorized', { sticker: sticker ?? STICKERS[0] });
                })}
                style={styles.primary}
              >
                <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Save'}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </Modal>
    </>
  );
}

function StickerRow({ value, onChange, styles }: { value: string | null; onChange: (v: string | null) => void; colors: Theme; styles: ReturnType<typeof makeStyles> }) {
  return (
    <View style={styles.stickers} accessibilityRole="radiogroup">
      {STICKERS.map((s) => (
        <Pressable
          key={s}
          accessibilityRole="radio"
          accessibilityState={{ checked: value === s }}
          onPress={() => onChange(value === s ? null : s)}
          style={[styles.stickerCell, value === s && styles.stickerOn]}
        >
          <Text style={styles.stickerEmoji}>{s}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  addButton: { minHeight: TOUCH - 6, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.tintFill, flexDirection: 'row', alignItems: 'center', gap: 6 },
  addText: { fontSize: colors.fs(15), fontWeight: '600', color: colors.onTint },
  sheet: { padding: 20, paddingTop: 24, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: colors.fs(22), fontWeight: '700', color: colors.label },
  close: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tab: { minHeight: TOUCH, paddingHorizontal: 12, borderRadius: 16, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 6 },
  tabOn: { backgroundColor: colors.tintFill },
  tabText: { fontSize: colors.fs(14), color: colors.muted, fontWeight: '500' },
  tabTextOn: { color: colors.onTint, fontWeight: '600' },
  stack: { gap: 12 },
  input: { minHeight: TOUCH, borderRadius: 16, paddingHorizontal: 16, backgroundColor: colors.card, color: colors.label, fontSize: colors.fs(16) },
  multiline: { minHeight: 120, paddingVertical: 14, textAlignVertical: 'top' },
  hint: { fontSize: colors.fs(13), color: colors.muted },
  primary: { minHeight: TOUCH + 4, borderRadius: 16, backgroundColor: colors.tintFill, alignItems: 'center', justifyContent: 'center' },
  primaryText: { fontSize: colors.fs(16), fontWeight: '600', color: colors.onTint },
  recordButton: { alignSelf: 'center', width: 88, height: 88, borderRadius: 44, backgroundColor: colors.tintFill, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  recordButtonOn: { backgroundColor: colors.destructive },
  stickers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stickerCell: { width: TOUCH, height: TOUCH, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stickerOn: { borderWidth: 2, borderColor: colors.tint },
  stickerEmoji: { fontSize: 22 },
});
