import { useEffect, useRef, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useAudioRecorder, useAudioRecorderState, RecordingPresets, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { Text } from '../theme/typography';
import { t } from '../i18n';
import { Symbol } from './symbol';
import { TOUCH } from './ui';
import { useThemed, type Theme } from '../theme/theme';

/** One attachment per entry: a file from the library or a music link. Mirrors the web composer. */
export type Attachment =
  | { kind: 'photo' | 'video'; asset: { uri: string; name: string; type: string } }
  | { kind: 'music'; url: string; title: string };

export const STICKERS = ['🌿', '☀️', '🌙', '⭐', '💧', '🔥', '🎯', '📚', '🏃', '☕', '🎵', '💛'];
const MAX_AUDIO_S = 120;

/** Records a voice note with expo-audio; `onDone` gets the file and its length in seconds. */
export function useVoiceNote(onDone: (file: { uri: string; name: string; type: string }, seconds: number) => void) {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const state = useAudioRecorderState(recorder, 500);
  const [startedAt, setStartedAt] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  const stop = async () => {
    if (!state.isRecording) return;
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    const uri = recorder.uri;
    const length = Math.min(MAX_AUDIO_S, Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    if (uri) done.current({ uri, name: 'note.m4a', type: 'audio/m4a' }, length);
  };

  useEffect(() => {
    if (!state.isRecording) return;
    const id = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= MAX_AUDIO_S) void stop();
    }, 500);
    return () => clearInterval(id);
    // stop() only changes when a recording starts or ends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isRecording, startedAt]);

  const start = async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(t('timeline.audio'), t('compose.mic_denied'));
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    setStartedAt(Date.now());
    setSeconds(0);
    recorder.record();
  };

  return { recording: state.isRecording, seconds, start, stop };
}

function Tool({ label, symbol, pressed, onPress, disabled, children }: { label: string; symbol?: string; pressed?: boolean; onPress: () => void; disabled?: boolean; children?: React.ReactNode }) {
  const { colors, styles } = useThemed(makeStyles);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: !!pressed, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed: down }) => [styles.tool, pressed && styles.toolOn, down && { opacity: 0.6 }]}
    >
      {children ?? <Symbol name={symbol ?? 'circle'} size={20} color={pressed ? colors.onTint : colors.tint} />}
    </Pressable>
  );
}

/** The composer's attachment bar, after Apple Journal: photo, video, music, voice, quote and sticker. */
export function AttachmentBar({
  attachment, onAttachment, quote, onQuote, sticker, onSticker, voice, disabled,
}: {
  attachment: Attachment | null;
  onAttachment: (a: Attachment | null) => void;
  quote: boolean;
  onQuote: (on: boolean) => void;
  sticker: string | null;
  onSticker: (s: string | null) => void;
  voice: ReturnType<typeof useVoiceNote>;
  disabled?: boolean;
}) {
  const { colors, styles } = useThemed(makeStyles);
  const [showStickers, setShowStickers] = useState(false);

  const pick = async (kind: 'photo' | 'video') => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: kind === 'photo' ? ['images'] : ['videos'], quality: 0.8, videoMaxDuration: 60 });
    const asset = res.canceled ? null : res.assets[0];
    if (!asset) return;
    onAttachment({
      kind,
      asset: { uri: asset.uri, name: asset.fileName ?? `${kind}-${Date.now()}`, type: asset.mimeType ?? (kind === 'photo' ? 'image/jpeg' : 'video/mp4') },
    });
  };

  if (voice.recording) {
    return (
      <View style={styles.recording} accessibilityLiveRegion="polite">
        <View style={styles.recDot} />
        <Text style={styles.recText}>
          {t('timeline.recording')} · {Math.floor(voice.seconds / 60)}:{String(voice.seconds % 60).padStart(2, '0')}
        </Text>
        <Pressable accessibilityRole="button" accessibilityLabel={t('timeline.stop')} onPress={() => void voice.stop()} style={styles.stop}>
          <Symbol name="stop.fill" size={16} color={colors.onTint} />
          <Text style={styles.stopText}>{t('timeline.stop')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bar} accessibilityRole="toolbar" accessibilityLabel={t('compose.attach')}>
        <Tool label={t('timeline.photo')} symbol="photo" pressed={attachment?.kind === 'photo'} onPress={() => void pick('photo')} disabled={disabled} />
        <Tool label={t('timeline.video')} symbol="video.fill" pressed={attachment?.kind === 'video'} onPress={() => void pick('video')} disabled={disabled} />
        <Tool
          label={t('timeline.music')}
          symbol="music.note"
          pressed={attachment?.kind === 'music'}
          onPress={() => onAttachment(attachment?.kind === 'music' ? null : { kind: 'music', url: '', title: '' })}
          disabled={disabled}
        />
        <Tool label={t('timeline.record')} symbol="mic.fill" onPress={() => void voice.start()} disabled={disabled} />
        <Tool label={t('timeline.quote')} symbol="quote.opening" pressed={quote} onPress={() => onQuote(!quote)} disabled={disabled} />
        <Tool label={t('timeline.sticker')} pressed={showStickers || !!sticker} onPress={() => setShowStickers((s) => !s)} disabled={disabled}>
          {sticker ? <Text style={styles.stickerGlyph}>{sticker}</Text> : <Symbol name="face.smiling" size={20} color={showStickers ? colors.onTint : colors.tint} />}
        </Tool>
      </ScrollView>

      {showStickers ? (
        <View style={styles.stickers} accessibilityRole="radiogroup" accessibilityLabel={t('timeline.stickerPick')}>
          {STICKERS.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="radio"
              accessibilityState={{ checked: sticker === s }}
              onPress={() => onSticker(sticker === s ? null : s)}
              style={[styles.sticker, sticker === s && styles.stickerOn]}
            >
              <Text style={styles.stickerGlyph}>{s}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      {attachment?.kind === 'music' ? (
        <View style={styles.card}>
          <TextInput
            value={attachment.url}
            onChangeText={(url) => onAttachment({ ...attachment, url })}
            placeholder={t('timeline.musicLink')}
            placeholderTextColor={colors.muted}
            autoCapitalize="none"
            keyboardType="url"
            accessibilityLabel={t('timeline.musicLink')}
            style={styles.field}
          />
          <TextInput
            value={attachment.title}
            onChangeText={(title) => onAttachment({ ...attachment, title })}
            placeholder={t('timeline.musicTitle')}
            placeholderTextColor={colors.muted}
            accessibilityLabel={t('timeline.musicTitle')}
            style={styles.field}
          />
          <Text style={styles.hint}>{t('timeline.musicHint')}</Text>
        </View>
      ) : null}

      {attachment && attachment.kind !== 'music' ? (
        <View style={styles.preview}>
          {attachment.kind === 'photo' ? (
            <Image source={{ uri: attachment.asset.uri }} style={styles.thumb} accessibilityIgnoresInvertColors />
          ) : (
            <View style={[styles.thumb, styles.thumbVideo]}>
              <Symbol name="video.fill" size={20} color={colors.muted} />
            </View>
          )}
          <Text style={styles.fileName} numberOfLines={1}>{attachment.asset.name}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel={t('compose.remove_attachment')} onPress={() => onAttachment(null)} style={styles.remove}>
            <Symbol name="xmark" size={14} color={colors.muted} />
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  wrap: { gap: 12 },
  bar: { gap: 4 },
  tool: { width: TOUCH, height: TOUCH, borderRadius: TOUCH / 2, alignItems: 'center', justifyContent: 'center' },
  toolOn: { backgroundColor: colors.tintFill },
  stickers: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  sticker: { width: TOUCH, height: TOUCH, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.card },
  stickerOn: { borderWidth: 2, borderColor: colors.tint },
  stickerGlyph: { fontSize: 22 },
  card: { backgroundColor: colors.card, borderRadius: 14, padding: 12, gap: 8 },
  field: { minHeight: TOUCH, fontSize: colors.fs(16), color: colors.label, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.separator },
  hint: { fontSize: colors.fs(13), color: colors.muted },
  preview: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 14, padding: 8 },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  thumbVideo: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.separator },
  fileName: { flex: 1, fontSize: colors.fs(14), color: colors.label },
  remove: { width: TOUCH, height: TOUCH, alignItems: 'center', justifyContent: 'center' },
  recording: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 14, paddingLeft: 16, paddingRight: 6, minHeight: TOUCH + 12 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.destructive },
  recText: { flex: 1, fontSize: colors.fs(16), color: colors.label, fontVariant: ['tabular-nums'] },
  stop: { minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, borderRadius: 999, backgroundColor: colors.destructive },
  stopText: { fontSize: colors.fs(15), fontWeight: '600', color: colors.onTint },
});
