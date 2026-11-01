import type { Metadata } from 'next';
import { DesignPage } from '@/components/design/design-page';

export const metadata: Metadata = {
  title: 'Design – Memo',
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DesignPage />;
}
