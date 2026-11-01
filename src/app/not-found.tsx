import Link from 'next/link';
import Image from 'next/image';
import { getDict } from '@/lib/marketing/locale';

export default function NotFound() {
  const { t, locale } = getDict();
  return (
    <main lang={locale} className="grid min-h-svh place-items-center bg-background px-4 text-center text-foreground">
      <div className="flex max-w-md flex-col items-center gap-4">
        <Image src="/logo.png" alt="Memo" width={48} height={48} className="rounded-xl" />
        <p className="caption-3 uppercase tracking-widest text-muted-foreground tabular-nums">404</p>
        <h1 className="heading-3 hero-ink pb-1">{t.notFound.title}</h1>
        <p className="body-3 text-muted-foreground">{t.notFound.body}</p>
        <Link
          href="/"
          className="button-md mt-4 inline-flex min-h-12 items-center rounded-full bg-primary px-6 text-primary-foreground transition-transform duration-300 ease-base active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          {t.notFound.cta}
        </Link>
      </div>
    </main>
  );
}
