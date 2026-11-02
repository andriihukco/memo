'use client';

import { PageHeader } from '@/components/shell/page-header';
import { useI18n } from '@/lib/i18n/context';
import { AppearanceSection } from '@/components/features/settings/appearance-section';

/** Theme, text size and heading font, on their own page reached from Settings. */
export default function AppearancePage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('miniapp.settings.appearance')} back />
      <div className="px-4 pb-6 pt-3">
        <AppearanceSection />
      </div>
    </>
  );
}
