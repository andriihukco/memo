import {
  Platform,
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
  type TextStyle,
} from 'react-native';
import {
  Commissioner_100Thin,
  Commissioner_200ExtraLight,
  Commissioner_300Light,
  Commissioner_400Regular,
  Commissioner_500Medium,
  Commissioner_600SemiBold,
  Commissioner_700Bold,
  Commissioner_800ExtraBold,
  Commissioner_900Black,
} from '@expo-google-fonts/commissioner';
import { useAppFont, type AppFont } from './font-store';

/** Fonts to pass to `useFonts` in the root layout. Every Text waits for these. */
export const COMMISSIONER_FONTS = {
  Commissioner_100Thin,
  Commissioner_200ExtraLight,
  Commissioner_300Light,
  Commissioner_400Regular,
  Commissioner_500Medium,
  Commissioner_600SemiBold,
  Commissioner_700Bold,
  Commissioner_800ExtraBold,
  Commissioner_900Black,
};

/** Each Commissioner weight is its own font face, so the family name depends on the weight. */
const FAMILY_BY_WEIGHT: Record<string, string> = {
  '100': 'Commissioner_100Thin',
  '200': 'Commissioner_200ExtraLight',
  '300': 'Commissioner_300Light',
  '400': 'Commissioner_400Regular',
  '500': 'Commissioner_500Medium',
  '600': 'Commissioner_600SemiBold',
  '700': 'Commissioner_700Bold',
  '800': 'Commissioner_800ExtraBold',
  '900': 'Commissioner_900Black',
  normal: 'Commissioner_400Regular',
  bold: 'Commissioner_700Bold',
};

/** System families for the serif and mono choices. Weights come from the style, as usual. */
const SYSTEM_FAMILY: Record<Exclude<AppFont, 'sans'>, string> = {
  serif: Platform.select({ ios: 'Georgia', default: 'serif' }) ?? 'serif',
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }) ?? 'monospace',
};

/** Families this module owns. A family outside this list is an explicit choice and is kept. */
const MANAGED = new Set<string>(['Georgia', 'Menlo', 'serif', 'monospace', ...Object.values(FAMILY_BY_WEIGHT)]);

/**
 * Applies the chosen app font to a style. Sans uses the Commissioner face that matches the weight;
 * serif and mono use the system family. Families set elsewhere on purpose are left alone.
 */
function withAppFont(style: TextProps['style'], font: AppFont): TextStyle {
  const flat: TextStyle = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily && !MANAGED.has(flat.fontFamily)) return flat;
  if (font !== 'sans') return { ...flat, fontFamily: SYSTEM_FAMILY[font] };
  const weight = String(flat.fontWeight ?? '400');
  return { ...flat, fontFamily: FAMILY_BY_WEIGHT[weight] ?? 'Commissioner_400Regular' };
}

/** Drop-in replacement for react-native's Text. Uses the app font everywhere. */
export function Text({ style, ...props }: TextProps) {
  const font = useAppFont();
  return <RNText {...props} style={withAppFont(style, font)} />;
}

/** Drop-in replacement for react-native's TextInput. Uses the app font everywhere. */
export function TextInput({ style, ...props }: TextInputProps) {
  const font = useAppFont();
  return <RNTextInput {...props} style={withAppFont(style, font)} />;
}
