import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../theme/typography';
import { useAudioPlayer } from 'expo-audio';
import { VideoView, useVideoPlayer } from 'expo-video';
import { Symbol } from './symbol';
import { haptic } from '../motion';
import type { Entry, EntryMedia } from '../lib/api';
import { useThemed, type Theme } from '../theme/theme';

/** Entries that get a rich card. Plain notes keep the journal's own card. */
export function isTimelineEntry(e: Entry): boolean {
  return (e.media?.length ?? 0) > 0 || e.metadata?.kind === 'quote' || typeof e.metadata?.sticker === 'string';
}

/** Sticker on the corner of a card, tilted, as on the web. */
function Sticker({ emoji }: { emoji: string }) {
  const { styles } = useThemed(makeStyles);
  return (
    <View style={styles.sticker} accessibilityLabel="sticker">
      <Text style={styles.stickerText}>{emoji}</Text>
    </View>
  );
}

function PhotoCard({ entry, media }: { entry: Entry; media: EntryMedia }) {
  const { styles } = useThemed(makeStyles);
  return (
    <View style={styles.card}>
      {media.url ? <Image source={{ uri: media.url }} style={styles.photo} accessibilityLabel={entry.content} /> : null}
      {entry.content ? <Text style={styles.caption}>{entry.content}</Text> : null}
      {typeof entry.metadata?.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </View>
  );
}

function VideoCard({ entry, media }: { entry: Entry; media: EntryMedia }) {
  const { styles } = useThemed(makeStyles);
  const player = useVideoPlayer(media.url ?? '', (p) => {
    p.loop = false;
  });
  return (
    <View style={styles.card}>
      {media.url ? <VideoView player={player} style={styles.photo} nativeControls /> : null}
      {entry.content ? <Text style={styles.caption}>{entry.content}</Text> : null}
      {typeof entry.metadata?.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </View>
  );
}

/** Audio note: play or pause the recording, then the words Memo read from it. */
function AudioCard({ entry, media }: { entry: Entry; media: EntryMedia }) {
  const { colors, styles } = useThemed(makeStyles);
  const player = useAudioPlayer(media.url ? { uri: media.url } : null);
  const [playing, setPlaying] = useState(false);
  const seconds = media.duration_s ?? 0;
  const toggle = () => {
    haptic.tap();
    if (playing) player.pause();
    else player.play();
    setPlaying(!playing);
  };
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <Pressable accessibilityRole="button" accessibilityLabel={playing ? 'Pause' : 'Play'} onPress={toggle} style={styles.playButton}>
          <Symbol name={playing ? 'pause.fill' : 'play.fill'} size={16} color={colors.onTint} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Audio note</Text>
          {seconds ? <Text style={styles.meta}>{`${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`}</Text> : null}
        </View>
      </View>
      <Text style={styles.body}>{entry.content}</Text>
      {typeof entry.metadata?.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </View>
  );
}

/** Music link: the service, the title the user wrote, and a tap that opens the track. */
function MusicCard({ entry, media }: { entry: Entry; media: EntryMedia }) {
  const { colors, styles } = useThemed(makeStyles);
  const url = media.meta?.url;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`${media.meta?.provider ?? 'music'}: ${entry.content}`}
      onPress={() => url && void Linking.openURL(url)}
      style={({ pressed }) => [styles.card, styles.musicRow, pressed && { opacity: 0.7 }]}
    >
      <View style={styles.musicIcon}>
        <Symbol name="music.note" size={22} color={colors.tint} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.eyebrow}>{media.meta?.provider ?? 'music'}</Text>
        <Text style={styles.title}>{entry.content}</Text>
      </View>
      <Symbol name="arrow.up.right" size={14} color={colors.muted} weight="semibold" />
      {typeof entry.metadata?.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </Pressable>
  );
}

function QuoteCard({ entry }: { entry: Entry }) {
  const { colors, styles } = useThemed(makeStyles);
  return (
    <View style={[styles.card, styles.quote]}>
      <Symbol name="quote.opening" size={22} color={colors.tint} />
      <Text style={styles.quoteText}>{entry.content}</Text>
      {typeof entry.metadata?.sticker === 'string' ? <Sticker emoji={entry.metadata.sticker} /> : null}
    </View>
  );
}

/** Picks the card for an entry. Returns null for plain notes. */
export function TimelineCard({ entry }: { entry: Entry }) {
  const { styles } = useThemed(makeStyles);
  const first = entry.media?.[0];
  if (first?.kind === 'photo') return <PhotoCard entry={entry} media={first} />;
  if (first?.kind === 'video') return <VideoCard entry={entry} media={first} />;
  if (first?.kind === 'audio') return <AudioCard entry={entry} media={first} />;
  if (first?.kind === 'music') return <MusicCard entry={entry} media={first} />;
  if (entry.metadata?.kind === 'quote') return <QuoteCard entry={entry} />;
  if (typeof entry.metadata?.sticker === 'string') {
    return (
      <View style={styles.card}>
        <Text style={styles.body}>{entry.content}</Text>
        <Sticker emoji={entry.metadata.sticker} />
      </View>
    );
  }
  return null;
}

const makeStyles = (colors: Theme) => StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 24, padding: 16, gap: 10, overflow: 'visible', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.separator },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 16, backgroundColor: colors.bg },
  caption: { fontSize: colors.fs(15), color: colors.label, lineHeight: colors.fs(21) },
  body: { fontSize: colors.fs(16), color: colors.label, lineHeight: colors.fs(22) },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: { fontSize: colors.fs(16), fontWeight: '600', color: colors.label },
  meta: { fontSize: colors.fs(13), color: colors.muted, marginTop: 2 },
  eyebrow: { fontSize: colors.fs(11), letterSpacing: 1, textTransform: 'uppercase', color: colors.muted },
  playButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.tintFill },
  musicRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  musicIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg },
  quote: { paddingVertical: 22, paddingHorizontal: 20, gap: 14 },
  quoteText: { fontSize: colors.fs(22), fontWeight: '600', color: colors.label, lineHeight: colors.fs(30) },
  sticker: { position: 'absolute', right: -8, top: -14, width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, transform: [{ rotate: '8deg' }], shadowColor: 'black', shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  stickerText: { fontSize: 24 },
});
