import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { useTheme } from '../theme/theme';

/** SF Symbol names, as typed by expo-symbols. */
export type SFName = NonNullable<SymbolViewProps['name']> extends infer N ? (N extends string ? N : never) : never;

/** SF Symbol (iOS). The app ships iOS first, so no Android fallback is drawn. */
export function Symbol({ name, size = 22, color, weight = 'semibold' }: {
  name: SFName | string;
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
}) {
  const { palette } = useTheme();
  return <SymbolView name={name as SFName} size={size} tintColor={color ?? palette.label} weight={weight} type="hierarchical" />;
}
