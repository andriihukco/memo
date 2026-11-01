'use client';

import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';

/** Reads the OS setting at call time. Motion helpers check it before they start. */
function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** True once the element has scrolled into view. Stays true after that. */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setInView(true);
        observer.disconnect();
      },
      { rootMargin: '0px 0px -60px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, inView] as const;
}

/** Fades and rises a block into view once. The transition is off for reduced motion. */
export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>();
  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delay}s` }}
      className={`transition-[opacity,transform] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none ${
        inView ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
      } ${className ?? ''}`}
    >
      {children}
    </div>
  );
}

/** Counts from 0 to `to` once, when it scrolls into view. Ease-out, about 1.4 seconds. */
export function CountUp({ to, suffix = '' }: { to: number; suffix?: string }) {
  const [ref, inView] = useInView<HTMLSpanElement>();
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView) return;
    if (prefersReducedMotion()) {
      setValue(to);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 1400);
      setValue(Math.round(to * (1 - Math.pow(1 - t, 4))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [inView, to]);

  return (
    <span ref={ref} className="tabular-nums">
      {value.toLocaleString('en-US')}
      {suffix}
    </span>
  );
}

/**
 * Mouse-only parallax. Writes --px and --py (-1..1) on the section, and children read them
 * in a calc() transform. Touch input and reduced motion leave the values at 0.
 */
export function usePointerParallax() {
  function onPointerMove(e: PointerEvent<HTMLElement>) {
    if (e.pointerType !== 'mouse' || prefersReducedMotion()) return;
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--px', String(((e.clientX - rect.left) / rect.width) * 2 - 1));
    e.currentTarget.style.setProperty('--py', String(((e.clientY - rect.top) / rect.height) * 2 - 1));
  }
  function onPointerLeave(e: PointerEvent<HTMLElement>) {
    e.currentTarget.style.setProperty('--px', '0');
    e.currentTarget.style.setProperty('--py', '0');
  }
  return { onPointerMove, onPointerLeave };
}

/** Inline transform that moves an element by `x` and `y` pixels per full pointer offset. */
export function parallax(x: number, y: number) {
  return { transform: `translate(calc(var(--px, 0) * ${x}px), calc(var(--py, 0) * ${y}px))` };
}
