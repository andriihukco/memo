'use client';

import React, { useEffect, useState } from 'react';
import { useTheme } from '@/lib/theme-provider';
import { Card, CardContent } from '@/components/legacy/card';
import { Separator } from '@/components/ui/separator';
import { Icon } from '@/components/ui/icon';
import { useI18n } from '@/lib/i18n/context';
import { hapticImpact } from '@/lib/haptics';
import {
  DEFAULT_PREFS,
  APP_FONTS,
  TEXT_SCALES,
  readAppearance,
  writeAppearance,
  type AppearancePrefs,
  type AppFont,
  type TextScale,
} from '@/lib/appearance';

interface Option<T extends string> {
  value: T;
  labelKey: string;
  icon?: string;
}

const THEMES: Option<'system' | 'light' | 'dark'>[] = [
  { value: 'system', labelKey: 'miniapp.settings.appearance.system', icon: 'monitor' },
  { value: 'light', labelKey: 'miniapp.settings.appearance.light', icon: 'sun' },
  { value: 'dark', labelKey: 'miniapp.settings.appearance.dark', icon: 'moon' },
];

const TEXT_SIZES: Option<TextScale>[] = TEXT_SCALES.map((value) => ({
  value,
  labelKey: `miniapp.settings.appearance.text_${value}`,
}));

const FONTS: Option<AppFont>[] = APP_FONTS.map((value) => ({
  value,
  labelKey: `miniapp.settings.appearance.font_${value}`,
}));

/** One radio group inside a card. Shared by theme, text size and font. */
function OptionCard<T extends string>({ label, options, value, onChange }: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (next: T) => void;
}) {
  const { t } = useI18n();
  return (
    <section>
      <p className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <Card>
        <CardContent className="p-0" role="radiogroup" aria-label={label}>
          {options.map((opt, i) => {
            const active = value === opt.value;
            return (
              <React.Fragment key={opt.value}>
                {i > 0 && <Separator />}
                <button
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    hapticImpact('light');
                    onChange(opt.value);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
                >
                  {opt.icon && <Icon name={opt.icon} size={18} className="text-primary" />}
                  <span className="flex-1 text-left text-sm font-medium">{t(opt.labelKey)}</span>
                  {active && <Icon name="check" size={16} className="text-primary" />}
                </button>
              </React.Fragment>
            );
          })}
        </CardContent>
      </Card>
    </section>
  );
}

/**
 * Appearance: theme (light is the daylight blue palette, dark, or system), text size and
 * heading font. Theme goes through next-themes; size and font through appearance.ts.
 */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const [prefs, setPrefs] = useState<AppearancePrefs>(DEFAULT_PREFS);

  // Read after mount so the server render and the first client render match.
  useEffect(() => {
    setPrefs(readAppearance());
  }, []);

  const update = (next: Partial<AppearancePrefs>) => {
    const merged = { ...prefs, ...next };
    setPrefs(merged);
    writeAppearance(merged);
  };

  return (
    <div className="space-y-6">
      <OptionCard
        label={t('miniapp.settings.appearance')}
        options={THEMES}
        value={(theme ?? 'system') as 'system' | 'light' | 'dark'}
        onChange={setTheme}
      />
      <OptionCard
        label={t('miniapp.settings.appearance.text_size')}
        options={TEXT_SIZES}
        value={prefs.textScale}
        onChange={(textScale) => update({ textScale })}
      />
      <OptionCard
        label={t('miniapp.settings.appearance.font')}
        options={FONTS}
        value={prefs.font}
        onChange={(font) => update({ font })}
      />
      <p className="px-1 text-xs text-muted-foreground">{t('miniapp.settings.appearance.body_note')}</p>
    </div>
  );
}
