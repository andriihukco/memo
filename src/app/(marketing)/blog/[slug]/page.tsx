import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { POSTS, getPost } from '@/lib/marketing/posts';
import { fill } from '@/lib/marketing/dict';
import { getDict } from '@/lib/marketing/locale';
import { PrimaryLink } from '@/components/marketing/landing-sections';

export function generateStaticParams() {
  return POSTS.map((p) => ({ slug: p.slug }));
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug);
  if (!post) return {};
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: { type: 'article', title: post.title, description: post.description, publishedTime: post.date },
  };
}

export default function BlogPost({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug);
  if (!post) notFound();
  const { t } = getDict();
  return (
    <article lang="en" className="mx-auto max-w-2xl px-4 pb-16 pt-32 sm:px-6">
      <Link href="/blog" className="body-5 inline-flex min-h-11 items-center gap-2 rounded-md text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <ArrowLeft className="size-4" aria-hidden />
        {t.blog.back}
      </Link>
      <p className="caption-5 mt-6 text-muted-foreground tabular-nums">
        <time dateTime={post.date}>{post.date}</time> · {fill(t.blog.minutes, { n: post.minutes })}
      </p>
      <h1 className="heading-2 hero-ink mt-2 pb-1">{post.title}</h1>
      <p className="body-3 mt-4 text-muted-foreground">{post.description}</p>
      <div className="mt-10 flex flex-col gap-4">
        {post.body.map((b, i) =>
          'h' in b ? (
            <h2 key={i} className="heading-6 mt-6">{b.h}</h2>
          ) : 'p' in b ? (
            <p key={i} className="body-3 text-foreground/85">{b.p}</p>
          ) : (
            <ul key={i} className="body-3 flex list-disc flex-col gap-2 pl-6 text-foreground/85">
              {b.ul.map((li) => <li key={li}>{li}</li>)}
            </ul>
          ),
        )}
      </div>
      <div className="mt-12 rounded-3xl border bg-card p-8 text-center">
        <p className="heading-5">{t.final.title}</p>
        <div className="mt-6 flex justify-center">
          <PrimaryLink href="/login">{t.hero.cta}</PrimaryLink>
        </div>
      </div>
    </article>
  );
}
