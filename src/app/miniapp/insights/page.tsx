'use client';

import { Suspense } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { PageHeader } from '@/components/shell/page-header';
import { ProfileButton } from '@/components/shell/profile-button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useI18n } from '@/lib/i18n/context';
import { GoalsContent } from '@/components/features/goals/goals-content';
import LegacyDashboard from '@/components/legacy/pages/dashboard';
import LegacyReports from '@/components/legacy/pages/reports';
import LegacyGraph from '@/components/legacy/pages/graph';

/** Trends segments, in order: Charts (widgets), Goals, Reports, Graph. */
const VIEWS = ['widgets', 'goals', 'reports', 'graph'] as const;
type View = (typeof VIEWS)[number];

const toView = (raw: string | null): View => {
  if (raw === 'overview') return 'widgets';
  return (VIEWS as readonly string[]).includes(raw ?? '') ? (raw as View) : 'widgets';
};

function Insights() {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const view = toView(params.get('view'));

  const select = (v: string) => {
    const next = new URLSearchParams(params.toString());
    next.set('view', v);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };

  return (
    <>
      <PageHeader title={t('shell.trends')} actions={<ProfileButton />}>
        <Tabs value={view} onValueChange={select}>
          <TabsList className="grid w-full grid-cols-4">
            {VIEWS.map((v) => (
              <TabsTrigger key={v} value={v}>
                {t(`insights.view.${v}`)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </PageHeader>
      {view === 'goals' ? <GoalsContent /> : view === 'reports' ? <LegacyReports /> : view === 'graph' ? <LegacyGraph /> : <LegacyDashboard />}
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
