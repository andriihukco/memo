import type { Metadata } from 'next';
import { LegalPage } from '@/components/marketing/legal-page';
import { TERMS } from '@/lib/marketing/legal';
import { getSiteLocale } from '@/lib/marketing/locale';

export function generateMetadata(): Metadata {
  return { title: TERMS[getSiteLocale()].title, alternates: { canonical: '/terms' } };
}

export default function Page() {
  return <LegalPage doc={TERMS[getSiteLocale()]} />;
}
