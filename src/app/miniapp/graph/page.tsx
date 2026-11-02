'use client';

import { PageHeader } from '@/components/shell/page-header';
import { ProfileButton } from '@/components/shell/profile-button';
import { useI18n } from '@/lib/i18n/context';
import LegacyGraph from '@/components/legacy/pages/graph';

/** Graph: the knowledge graph of your entries. Its own bottom tab. */
export default function GraphPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('shell.graph')} actions={<ProfileButton />} />
      <LegacyGraph />
    </>
  );
}
