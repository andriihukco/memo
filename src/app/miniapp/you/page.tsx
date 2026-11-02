'use client';

import { PageHeader } from '@/components/shell/page-header';
import { useI18n } from '@/lib/i18n/context';
import LegacySettings from '@/components/legacy/pages/settings';

export default function YouPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('settings.title')} back />
      <LegacySettings />
    </>
  );
}
