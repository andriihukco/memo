'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { useI18n } from '@/lib/i18n/context';
import LegacyDashboard from '@/components/legacy/pages/dashboard';
import LegacyReports from '@/components/legacy/pages/reports';
import LegacyGraph from '@/components/legacy/pages/graph';

// Phase 0 bridge: ?view= picks the legacy screen until Phase 1 C/D replace them.
function InsightsView() {
  const view = useSearchParams().get('view');
  if (view === 'reports') return <LegacyReports />;
  if (view === 'graph') return <LegacyGraph />;
  return <LegacyDashboard />;
}

export default function InsightsPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('shell.insights')} />
      <Suspense>
        <InsightsView />
      </Suspense>
    </>
  );
}
