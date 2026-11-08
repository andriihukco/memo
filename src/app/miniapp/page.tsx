'use client';

import { PageHeader } from '@/components/shell/page-header';
import { ProfileButton } from '@/components/shell/profile-button';
import { TodayContent } from '@/components/features/today/today-content';
import { useI18n } from '@/lib/i18n/context';

/** Today: the first tab and where the app opens. */
export default function TodayPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('shell.today')} actions={<ProfileButton />} />
      <TodayContent />
    </>
  );
}
