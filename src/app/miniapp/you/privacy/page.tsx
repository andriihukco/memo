'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/shell/page-header';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/lib/i18n/context';

// Stub: Phase 1 Task E builds Privacy; passcode and export still live in legacy You for now.
export default function PrivacyPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('shell.privacy')} back />
      <div className="px-4">
        <Button asChild variant="link" className="px-0">
          <Link href="/miniapp/you">{t('shell.back_to_you')}</Link>
        </Button>
      </div>
    </>
  );
}
