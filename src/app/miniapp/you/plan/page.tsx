'use client';

import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { useI18n } from '@/lib/i18n/context';
import { BILLING_ENABLED } from '@/lib/billing/plans';
import LegacySubscriptions from '@/components/legacy/pages/subscriptions';

export default function PlanPage() {
  const { t } = useI18n();
  // Plans are hidden while billing is off. Send direct visits back to settings.
  if (!BILLING_ENABLED) redirect('/miniapp/you');
  return (
    <>
      <PageHeader title={t('shell.plan')} back />
      <LegacySubscriptions />
    </>
  );
}
