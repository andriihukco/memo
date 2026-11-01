import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { PRIVACY } from '@/lib/marketing/legal';
import { getSiteLocale } from '@/lib/marketing/locale';

export function generateMetadata(): Metadata {
  return { title: PRIVACY[getSiteLocale()].title, alternates: { canonical: '/privacy' } };
}

export default function Page() {
  return <LegalPage doc={PRIVACY[getSiteLocale()]} />;
}
