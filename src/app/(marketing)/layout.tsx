import type { Metadata } from 'next';
import { SiteHeader } from '@/components/marketing/site-header';
import { SiteFooter } from '@/components/marketing/site-footer';
import { getDict } from '@/lib/marketing/locale';

export function generateMetadata(): Metadata {
  const { t, locale } = getDict();
  return {
    title: { default: t.meta.title, template: '%s · Memo' },
    description: t.meta.description,
    openGraph: { title: t.meta.title, description: t.meta.description, siteName: 'Memo', locale: locale === 'uk' ? 'uk_UA' : 'en_US', type: 'website' },
    twitter: { card: 'summary_large_image', title: t.meta.title, description: t.meta.description },
  };
}

/** Public site chrome: floating header, footer, and the html lang for the chosen locale. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  const { t, locale } = getDict();
  return (
    <div lang={locale} className="min-h-screen overflow-x-clip bg-background text-foreground">
      <SiteHeader t={t.nav} locale={locale} />
      <main id="main" tabIndex={-1} className="outline-none">
        {children}
      </main>
      <SiteFooter t={t} />
    </div>
  );
}
