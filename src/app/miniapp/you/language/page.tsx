'use client';

import { PageHeader } from '@/components/shell/page-header';
import { useI18n } from '@/lib/i18n/context';
import { LanguageSection } from '@/components/legacy/pages/settings';

/** Interface language, on its own page reached from Settings. */
export default function LanguagePage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('miniapp.settings.language')} back />
      <div className="px-4 pb-6 pt-3">
        <LanguageSection />
      </div>
    </>
  );
}
