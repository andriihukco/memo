'use client';

import { PageHeader } from '@/components/shell/page-header';
import { useI18n } from '@/lib/i18n/context';
import LegacyCategories from '@/components/legacy/pages/categories';

export default function CategoriesPage() {
  const { t } = useI18n();
  return (
    <>
      <PageHeader title={t('shell.categories')} back />
      <LegacyCategories />
    </>
  );
}
