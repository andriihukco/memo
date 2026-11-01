import Link from 'next/link';
import type { Dict } from '@/lib/marketing/dict';

const LINK = 'body-6 inline-flex min-h-11 items-center text-muted-foreground transition-colors duration-300 [@media(hover:hover)_and_(pointer:fine)]:hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md';

export function SiteFooter({ t }: { t: Dict }) {
  const year = new Date().getFullYear();
  return (
    <footer className="mx-auto max-w-6xl px-4 pb-[max(48px,env(safe-area-inset-bottom))] pt-16 sm:px-6">
      <div className="grid gap-8 rounded-3xl border bg-card p-6 sm:grid-cols-3 sm:p-8">
        <div>
          <p className="title-2">Memo</p>
          <p className="body-6 mt-2 text-muted-foreground">{t.footer.tagline}</p>
        </div>
        <nav aria-label={t.footer.product}>
          <p className="caption-3 uppercase tracking-widest text-muted-foreground">{t.footer.product}</p>
          <ul className="mt-2">
            <li><Link className={LINK} href="/#how">{t.nav.product}</Link></li>
            <li><Link className={LINK} href="/pricing">{t.nav.pricing}</Link></li>
            <li><Link className={LINK} href="/blog">{t.nav.blog}</Link></li>
          </ul>
        </nav>
        <nav aria-label={t.footer.legal}>
          <p className="caption-3 uppercase tracking-widest text-muted-foreground">{t.footer.legal}</p>
          <ul className="mt-2">
            <li><Link className={LINK} href="/privacy">{t.footer.privacy}</Link></li>
            <li><Link className={LINK} href="/terms">{t.footer.terms}</Link></li>
          </ul>
        </nav>
      </div>
      <p className="caption-5 mt-6 text-muted-foreground">{t.footer.note}</p>
      <p className="caption-5 mt-2 text-muted-foreground">© {year} Memo</p>
    </footer>
  );
}
