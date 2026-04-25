'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Icon } from '@/components/ui/icon';

interface Slide {
  emoji: string;
  title: string;
  body: string;
  bg: string;
  accent: string;
  isFinal?: boolean;
  showPrivacyBadge?: boolean;
}

const SLIDES: Slide[] = [
  {
    emoji: '📓',
    title: 'Твій особистий щоденник',
    body: 'Просто пиши або говори — Memo сам розбере що зберегти. Їжа, тренування, витрати, думки.',
    bg: 'from-indigo-950 to-slate-950',
    accent: 'text-indigo-400',
  },
  {
    emoji: '🤖',
    title: 'AI, що тебе розуміє',
    body: 'Memo аналізує твої записи, рахує калорії та макроси, трекає активність і відповідає на питання про твоє минуле.',
    bg: 'from-violet-950 to-slate-950',
    accent: 'text-violet-400',
  },
  {
    emoji: '📊',
    title: 'Дашборд і графіки',
    body: 'Всі твої метрики в одному місці. Бачиш прогрес, патерни і тренди — без зайвих зусиль.',
    bg: 'from-blue-950 to-slate-950',
    accent: 'text-blue-400',
  },
  {
    emoji: '💡',
    title: 'Розумні рекомендації',
    body: 'Memo помічає якщо ти мало спиш, п\'єш забагато алкоголю або не вистачає білка — і підказує що змінити.',
    bg: 'from-amber-950 to-slate-950',
    accent: 'text-amber-400',
  },
  {
    emoji: '🔐',
    title: 'Твої дані захищені',
    body: 'Всі записи шифруються на твоєму пристрої перед збереженням. Навіть ми не можемо їх прочитати. Твоя приватність — наш пріоритет.',
    bg: 'from-emerald-950 to-slate-950',
    accent: 'text-emerald-400',
    showPrivacyBadge: true,
  },
  {
    emoji: '⭐',
    title: 'Підтримай проект',
    body: 'Базові функції безкоштовні назавжди. Stars Pro відкриває розширену аналітику, рекомендації та пріоритетну обробку.',
    bg: 'from-yellow-950 to-slate-950',
    accent: 'text-yellow-400',
    isFinal: true,
  },
];

const ONBOARDING_KEY = 'memo_onboarding_done';

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [exiting, setExiting] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isDragging = useRef(false);
  const isScrolling = useRef<boolean | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const finish = () => {
    localStorage.setItem(ONBOARDING_KEY, '1');
    setExiting(true);
    setTimeout(() => router.replace('/miniapp'), 400);
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) setIndex(i => i + 1);
    else finish();
  };

  const goPrev = () => {
    if (index > 0) setIndex(i => i - 1);
  };

  // Touch handlers
  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isScrolling.current = null;
    isDragging.current = true;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (isScrolling.current === null) {
      isScrolling.current = Math.abs(dy) > Math.abs(dx);
    }
    if (isScrolling.current) return;
    e.preventDefault();
    setDragOffset(dx);
  };

  const onTouchEnd = () => {
    isDragging.current = false;
    setDragging(false);
    if (isScrolling.current) { setDragOffset(0); return; }
    if (dragOffset < -60) goNext();
    else if (dragOffset > 60) goPrev();
    setDragOffset(0);
  };

  const slide = SLIDES[index];

  return (
    <div
      className={cn(
        'fixed inset-0 flex flex-col items-center justify-between bg-gradient-to-b px-6 pb-12 pt-16 transition-opacity duration-400',
        slide.bg,
        exiting && 'opacity-0'
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Skip */}
      <button
        onClick={finish}
        className="absolute right-5 top-14 text-sm text-white/40 hover:text-white/70 transition-colors"
      >
        Пропустити
      </button>

      {/* Content */}
      <div
        className="relative flex flex-1 flex-col items-center justify-center text-center"
        style={{
          transform: `translateX(${dragging ? dragOffset * 0.3 : 0}px)`,
          transition: dragging ? 'none' : 'transform 0.3s ease',
        }}
      >
        <div className="mb-8 text-8xl leading-none select-none">{slide.emoji}</div>
        <h1 className={cn('mb-4 text-3xl font-bold text-white leading-tight', slide.accent)}>
          {slide.title}
        </h1>
        <p className="max-w-xs text-base leading-relaxed text-white/60">
          {slide.body}
        </p>

        {/* Privacy badge — shown on Slide 5 */}
        {slide.showPrivacyBadge && (
          <div className="absolute bottom-0 left-0 flex items-center gap-1.5">
            <Icon name="lock" size={16} className="text-emerald-400/60" />
            <span className="text-[11px] text-emerald-400/60">Зашифровано</span>
          </div>
        )}
      </div>

      {/* Dots */}
      <div className="mb-8 flex gap-2">
        {SLIDES.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndex(i)}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/25'
            )}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={goNext}
          className={cn(
            'w-full rounded-2xl py-4 text-base font-semibold text-slate-950 transition-all active:scale-95',
            slide.isFinal
              ? 'bg-yellow-400 shadow-lg shadow-yellow-400/30'
              : 'bg-white shadow-lg shadow-white/10'
          )}
        >
          {slide.isFinal ? 'Почати безкоштовно →' : 'Далі →'}
        </button>
        {index > 0 && (
          <button
            onClick={goPrev}
            className="w-full py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
          >
            ← Назад
          </button>
        )}
      </div>
    </div>
  );
}
