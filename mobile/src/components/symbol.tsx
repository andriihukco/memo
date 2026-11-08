import { SymbolView, type AndroidSymbol, type SymbolViewProps } from 'expo-symbols';
import { useTheme } from '../theme/theme';

/** SF Symbol names, as typed by expo-symbols. */
export type SFName = NonNullable<SymbolViewProps['name']> extends infer N ? (N extends string ? N : never) : never;

/**
 * The Material Symbol drawn on Android (and web) for each SF Symbol the app uses. expo-symbols draws
 * SF Symbols on iOS only, so without this Android showed blank tabs and buttons.
 * src/__tests__/android-symbols.test.ts fails when an SF name is used without an entry here.
 */
export const MATERIAL: Record<string, AndroidSymbol> = {
  'arrow.up.right': 'arrow_outward',
  bell: 'notifications',
  'bolt.fill': 'bolt',
  'book.closed': 'book',
  'book.closed.fill': 'book',
  'bubble.left.fill': 'chat_bubble',
  'chart.bar.xaxis': 'bar_chart',
  'chart.line.uptrend.xyaxis': 'show_chart',
  checkmark: 'check',
  'checkmark.circle': 'check_circle',
  'checkmark.seal.fill': 'verified',
  'chevron.backward': 'arrow_back',
  'chevron.right': 'chevron_right',
  circle: 'circle',
  'circle.lefthalf.filled': 'contrast',
  'cup.and.saucer.fill': 'coffee',
  'delete.left': 'backspace',
  'drop.fill': 'water_drop',
  'face.smiling': 'sentiment_satisfied',
  'figure.walk': 'directions_walk',
  'flame.fill': 'local_fire_department',
  'fork.knife': 'restaurant',
  'gift.fill': 'redeem',
  globe: 'language',
  heart: 'favorite',
  'info.circle': 'info',
  'key.fill': 'key',
  leaf: 'eco',
  lightbulb: 'lightbulb',
  'lightbulb.fill': 'lightbulb',
  'lock.fill': 'lock',
  'lock.open.fill': 'lock_open',
  'lock.shield.fill': 'shield_lock',
  map: 'map',
  'megaphone.fill': 'campaign',
  'mic.fill': 'mic',
  'moon.fill': 'dark_mode',
  'music.note': 'music_note',
  'note.text': 'sticky_note_2',
  'pause.fill': 'pause',
  'person.crop.circle': 'account_circle',
  photo: 'image',
  'play.fill': 'play_arrow',
  plus: 'add',
  'point.3.connected.trianglepath.dotted': 'hub',
  'point.3.filled.connected.trianglepath.dotted': 'hub',
  'questionmark.circle': 'help',
  'quote.opening': 'format_quote',
  'rectangle.portrait.and.arrow.right': 'logout',
  scalemass: 'scale',
  sparkles: 'auto_awesome',
  'square.and.arrow.down': 'download',
  'square.and.pencil': 'edit_square',
  'stop.fill': 'stop',
  'sun.max': 'light_mode',
  'sun.max.fill': 'light_mode',
  tag: 'sell',
  'tag.fill': 'sell',
  textformat: 'text_fields',
  'textformat.size': 'format_size',
  timer: 'timer',
  'trash.fill': 'delete',
  'video.fill': 'videocam',
  'waveform.path.ecg': 'monitor_heart',
  xmark: 'close',
};

/** SF Symbol on iOS; the matching Material Symbol on Android and web. */
export function Symbol({ name, size = 22, color, weight = 'semibold' }: {
  name: SFName | string;
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
}) {
  const { palette } = useTheme();
  const material = MATERIAL[name] ?? 'circle';
  return (
    <SymbolView
      name={{ ios: name as SFName, android: material, web: material }}
      size={size}
      tintColor={color ?? palette.label}
      weight={weight}
      type="hierarchical"
    />
  );
}
