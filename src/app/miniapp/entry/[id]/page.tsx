'use client';

import { PageHeader } from '@/components/shell/page-header';
import { Skeleton } from '@/components/ui/skeleton';
import { useI18n } from '@/lib/i18n/context';

// Stub: Phase 1 Task A builds the entry screen.
export default function EntryPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('shell.entry')} back />
      <Skeleton className="mx-4 h-40 rounded-lg" />
    </>
  );
}
