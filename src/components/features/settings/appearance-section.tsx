'use client';

import React from 'react';
import { useTheme } from '@/lib/theme-provider';
import { Card, CardContent } from '@/components/legacy/card';
import { Separator } from '@/components/ui/separator';
import { Icon } from '@/components/ui/icon';
import { useI18n } from '@/lib/i18n/context';
import { hapticImpact } from '@/lib/haptics';

type AppearanceChoice = 'system' | 'light' | 'dark';

const OPTIONS: { value: AppearanceChoice; labelKey: string; icon: string }[] = [
  { value: 'system', labelKey: 'miniapp.settings.appearance.system', icon: 'monitor' },
  { value: 'light', labelKey: 'miniapp.settings.appearance.light', icon: 'sun' },
  { value: 'dark', labelKey: 'miniapp.settings.appearance.dark', icon: 'moon' },
];

/**
 * Light / dark / system switch. Writes next-themes' stored choice, which
 * switches the `.dark` class and therefore the token set in globals.css.
 */
export function AppearanceSection() {
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const current = (theme ?? 'system') as AppearanceChoice;

  return (
    <section>
      <p id="appearance-heading" className="mb-2 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {t('miniapp.settings.appearance')}
      </p>
      <Card>
        <CardContent className="p-0" role="radiogroup" aria-labelledby="appearance-heading">
          {OPTIONS.map((opt, i) => {
            const active = current === opt.value;
            return (
              <React.Fragment key={opt.value}>
                {i > 0 && <Separator />}
                <button
                  role="radio"
                  aria-checked={active}
                  onClick={() => {
                    hapticImpact('light');
                    setTheme(opt.value);
                  }}
                  className="flex min-h-11 w-full items-center gap-3 px-4 py-3.5 transition-colors hover:bg-muted/50"
                >
                  <Icon name={opt.icon} size={18} className="text-primary" />
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
