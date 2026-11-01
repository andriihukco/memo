'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useInView } from '@/components/features/landing/motion-kit';
import { cn } from '@/lib/utils';

/** Rises 32px and fades in once, on the base curve. Reduced motion shows it at once. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
      className={cn(
        'transition-[opacity,transform] duration-700 ease-base motion-reduce:transform-none motion-reduce:opacity-100 motion-reduce:transition-none',
        inView ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0',
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Tagline reveal (landing skill B11). Each word goes from 30% to full ink as it crosses a line at
 * 65% of the viewport. One passive scroll listener, throttled through requestAnimationFrame.
 */
export function TaglineReveal({ lines }: { lines: readonly string[] }) {
  const ref = useRef<HTMLParagraphElement>(null);
  const [lit, setLit] = useState(0);
  const words = lines.map((l) => l.split(' '));
  const total = words.flat().length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setLit(total);
      return;
    }
    let frame = 0;
    const spans = Array.from(el.querySelectorAll<HTMLElement>('[data-word]'));
    const measure = () => {
      frame = 0;
      const line = window.innerHeight * 0.65;
      let n = 0;
      for (const s of spans) {
        if (s.getBoundingClientRect().top < line) n++;
        else break;
      }
      setLit((prev) => Math.max(prev, n));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [total]);

  let i = 0;
  return (
    <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6 sm:py-32">
      <p ref={ref} className="heading-2 max-w-[880px]">
        {words.map((line, li) => (
          <span key={li} className="block">
            {line.map((w) => {
              const idx = i++;
              return (
                <span
                  key={idx}
                  data-word
                  className={cn('transition-opacity duration-500 ease-base', idx < lit ? 'opacity-100' : 'opacity-30')}
                >
                  {w}{' '}
                </span>
              );
            })}
          </span>
        ))}
      </p>
    </section>
  );
}
