import { SymbolView, type SymbolViewProps } from 'expo-symbols';

/** SF Symbol names, as typed by expo-symbols. */
export type SFName = NonNullable<SymbolViewProps['name']> extends infer N ? (N extends string ? N : never) : never;
import { colors } from './ui';

/** SF Symbol (iOS). The app ships iOS first, so no Android fallback is drawn. */
export function Symbol({ name, size = 22, color = colors.label, weight = 'semibold' }: {
  name: SFName | string;
  size?: number;
  color?: string;
  weight?: SymbolViewProps['weight'];
}) {
  return <SymbolView name={name as SFName} size={size} tintColor={color} weight={weight} type="hierarchical" />;
}
