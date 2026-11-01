'use client';

import { useTheme } from '@/lib/theme-provider';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';

const OPTIONS = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Sepia' },
  { value: 'dark', label: 'Dark' },
] as const;

/** Light (sepia), dark or system. Same stored choice as Settings > Appearance. */
export function ThemeSwitch() {
  const { theme, setTheme } = useTheme();
  return (
    <ToggleGroup
      type="single"
      value={theme ?? 'system'}
      onValueChange={(value) => value && setTheme(value)}
      aria-label="Theme"
    >
      {OPTIONS.map((o) => (
        <ToggleGroupItem key={o.value} value={o.value} className="min-h-11 px-3 text-sm" aria-label={`${o.label} theme`}>
          {o.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
