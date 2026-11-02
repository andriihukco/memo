import type { Metadata } from 'next';
import { PricingTable } from '@/components/marketing/pricing-table';
import { Faq } from '@/components/marketing/landing-sections';
import { BILLING_ENABLED } from '@/lib/billing/plans';
import { getDict } from '@/lib/marketing/locale';

export function generateMetadata(): Metadata {
  const { t } = getDict();
  return { title: t.pricing.title, description: t.pricing.sub, alternates: { canonical: '/pricing' } };
}

export default function PricingPage() {
  const { t, locale } = getDict();
  const billingOpen = !BILLING_ENABLED;
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 pb-16 pt-40 sm:px-6" aria-labelledby="pricing-title">
        <h1 id="pricing-title" className="heading-1 mx-auto max-w-[680px] pb-1 text-center text-balance">{t.pricing.title}</h1>
        <p className="body-3 mx-auto mt-4 max-w-[680px] text-center text-muted-foreground">{t.pricing.sub}</p>
        {billingOpen ? (
          <p role="note" className="body-5 mx-auto mt-8 max-w-[680px] rounded-2xl border bg-card px-4 py-3 text-center">
            {t.pricing.early}
          </p>
        ) : null}
        <div className="mt-12">
          <PricingTable t={t.pricing} billingOpen={billingOpen} locale={locale} />
        </div>
      </section>
      <Faq t={{ eyebrow: t.faq.eyebrow, title: t.pricing.title, items: t.pricing.faq }} />
    </>
  );
}
