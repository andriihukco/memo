import type { Metadata } from 'next';
import { AdaptiveHero } from '@/components/marketing/adaptive-hero';
import { TaglineReveal } from '@/components/marketing/reveal';
import { Benefits, Faq, FinalCta, HowItWorks, PricingTeaser, Privacy } from '@/components/marketing/landing-sections';
import { BILLING_ENABLED } from '@/lib/billing/plans';
import { isPersona } from '@/lib/marketing/dict';
import { getDict } from '@/lib/marketing/locale';

const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

export function generateMetadata({ searchParams }: { searchParams: { for?: string } }): Metadata {
  const { t } = getDict();
  const persona = isPersona(searchParams.for) ? t.personas[searchParams.for] : null;
  return {
    title: { absolute: persona ? `${persona.h1.join(' ')} · Memo` : t.meta.title },
    description: persona?.sub ?? t.meta.description,
    // Persona variants share one canonical page until /for/<slug> pages exist.
    alternates: { canonical: '/' },
  };
}

export default function Home({ searchParams }: { searchParams: { for?: string } }) {
  const { t } = getDict();
  const billingOpen = !BILLING_ENABLED;
  const initial = isPersona(searchParams.for) ? searchParams.for : null;
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.items.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };

  return (
    <>
      <AdaptiveHero
        t={{ hero: t.hero, band: t.band, personas: t.personas }}
        initial={initial}
        telegramUrl={TELEGRAM_BOT ? `https://t.me/${TELEGRAM_BOT}` : null}
        billingOpen={billingOpen}
      />
      <TaglineReveal lines={t.tagline} />
      <HowItWorks t={t.how} />
      <Benefits t={t.benefits} />
      <Privacy t={t.privacy} />
      <PricingTeaser t={t.teaser} billingOpen={billingOpen} />
      <Faq t={t.faq} />
      <FinalCta t={t.final} cta={t.hero.cta} proof={billingOpen ? t.hero.proofOpen : t.hero.proofPaid} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }} />
    </>
  );
}
