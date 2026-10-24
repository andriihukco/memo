'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/lib/i18n/context';
import LegacyDashboard from '@/components/legacy/pages/dashboard';
import LegacyReports from '@/components/legacy/pages/reports';
import LegacyGraph from '@/components/legacy/pages/graph';

const VIEWS = ['overview', 'reports', 'graph'] as const;
type View = (typeof VIEWS)[number];

// Phase 0 bridge: ?view= picks the legacy screen until Phase 1 C/D replace them.
function Insights() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const raw = params.get('view');
  const view: View = (VIEWS as readonly string[]).includes(raw ?? '') ? (raw as View) : 'overview';

  const select = (v: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('view', v);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  return (
    <>
      <PageHeader title={t('shell.insights')}>
        <Tabs value={view} onValueChange={select}>
          <TabsList className="grid w-full grid-cols-3">
            {VIEWS.map((v) => (
              <TabsTrigger key={v} value={v}>
                {t(`insights.view.${v}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>
      {view === 'reports' ? <LegacyReports /> : view === 'graph' ? <LegacyGraph /> : <LegacyDashboard />}
    </>
  );
}

export default function InsightsPage() {
  return (
    <Suspense>
      <Insights />
    </Suspense>
  );
}
