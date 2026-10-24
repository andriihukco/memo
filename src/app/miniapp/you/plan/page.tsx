'use client';

import { PageHeader } from '@/components/shell/page-header';
import { useI18n } from '@/lib/i18n/context';
import LegacySubscriptions from '@/components/legacy/pages/subscriptions';

export default function PlanPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('shell.plan')} back />
      <LegacySubscriptions />
    </>
  );
}
