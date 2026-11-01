import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { POSTS } from '@/lib/marketing/posts';
import { fill } from '@/lib/marketing/dict';
import { getDict } from '@/lib/marketing/locale';

export function generateMetadata(): Metadata {
  const { t } = getDict();
  return { title: t.blog.title, description: t.blog.sub, alternates: { canonical: '/blog' } };
}

export default function BlogIndex() {
  const { t } = getDict();
  return (
    <section className="mx-auto max-w-3xl px-4 pb-16 pt-32 sm:px-6" aria-labelledby="blog-title">
      <h1 id="blog-title" className="heading-1 hero-ink pb-1">{t.blog.title}</h1>
      <p className="body-3 mt-4 max-w-[680px] text-muted-foreground">{t.blog.sub}</p>
      {t.blog.onlyEn ? <p className="caption-4 mt-2 text-muted-foreground">{t.blog.onlyEn}</p> : null}
      <ul className="mt-12 flex flex-col gap-4">
        {POSTS.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              lang="en"
              className="group block rounded-2xl border bg-card p-6 transition-transform duration-500 ease-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)_and_(pointer:fine)]:hover:-translate-y-1"
            >
              <p className="caption-5 text-muted-foreground tabular-nums">
                <time dateTime={post.date}>{post.date}</time> · {fill(t.blog.minutes, { n: post.minutes })}
              </p>
              <h2 className="heading-6 mt-2">{post.title}</h2>
              <p className="body-6 mt-2 text-muted-foreground">{post.description}</p>
              <span className="body-5 mt-4 inline-flex items-center gap-2">
                {t.blog.read}
                <ArrowRight className="size-4 transition-transform duration-300 ease-base group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
