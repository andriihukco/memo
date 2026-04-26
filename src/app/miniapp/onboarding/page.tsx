'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
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
    emoji: '🔵',
    title: 'Твій особистий щоденник',
    body: 'Просто напиши або запиши аудіо, я сам розберусь. Memo сам розбере що зберегти. Їжа, тренування, витрати, думки.',
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

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? 80 : -80,
    opacity: 0,
    scale: 0.92,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (dir: number) => ({
    x: dir > 0 ? -80 : 80,
    opacity: 0,
    scale: 0.92,
  }),
};

export default function OnboardingPage() {
  const router = useRouter();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
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
    if (index < SLIDES.length - 1) {
      setDirection(1);
      setIndex(i => i + 1);
    } else {
      finish();
    }
  };

  const goPrev = () => {
    if (index > 0) {
      setDirection(-1);
      setIndex(i => i - 1);
    }
  };

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
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: exiting ? 0 : 1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'fixed inset-0 flex flex-col items-center justify-between bg-gradient-to-b px-6 pb-12 pt-16',
        slide.bg,
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Skip */}
      <motion.button
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.3 }}
        onClick={finish}
        className="absolute right-5 top-14 text-sm text-white/40 hover:text-white/70 transition-colors min-h-[44px] flex items-center"
      >
        Пропустити
      </motion.button>

      {/* Slide content */}
      <div className="relative flex flex-1 flex-col items-center justify-center text-center overflow-hidden w-full">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={index}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }}
            className="flex flex-col items-center"
            style={{
              x: dragging ? dragOffset * 0.15 : 0,
            }}
          >
            {/* Emoji with bounce-in */}
            <motion.div
              className="mb-8 text-8xl leading-none select-none"
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.05 }}
            >
              {slide.emoji}
            </motion.div>

            {/* Title */}
            <motion.h1
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className={cn('mb-4 text-3xl font-bold text-white leading-tight', slide.accent)}
            >
              {slide.title}
            </motion.h1>

            {/* Body */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-xs text-base leading-relaxed text-white/60"
            >
              {slide.body}
            </motion.p>

            {/* Privacy badge */}
            {slide.showPrivacyBadge && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.4, type: 'spring', stiffness: 300, damping: 20 }}
                className="mt-5 flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-3 py-1.5"
              >
                <Icon name="lock" size={14} className="text-emerald-400/80" />
                <span className="text-[12px] text-emerald-400/80">Зашифровано</span>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dots */}
      <div className="mb-8 flex gap-2 items-center">
        {SLIDES.map((_, i) => (
          <motion.button
            key={i}
            onClick={() => { setDirection(i > index ? 1 : -1); setIndex(i); }}
            animate={{ width: i === index ? 20 : 6 }}
            transition={{ type: 'spring', stiffness: 400, damping: 28 }}
            style={{ height: 6, minWidth: 0, minHeight: 0 }}
            className={cn('rounded-full', i === index ? 'bg-white' : 'bg-white/25')}
          />
        ))}
      </div>

      {/* CTA */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, type: 'spring', stiffness: 300, damping: 26 }}
        className="w-full max-w-xs space-y-3"
      >
        <motion.button
          whileTap={{ scale: 0.96 }}
          onClick={goNext}
          className={cn(
            'w-full rounded-2xl py-4 text-base font-semibold text-slate-950 transition-colors',
            slide.isFinal
              ? 'bg-yellow-400 shadow-lg shadow-yellow-400/30'
              : 'bg-white shadow-lg shadow-white/10'
          )}
        >
          {slide.isFinal ? 'Почати безкоштовно →' : 'Далі →'}
        </motion.button>

        <AnimatePresence>
          {index > 0 && (
            <motion.button
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              onClick={goPrev}
              className="w-full py-2 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              ← Назад
            </motion.button>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
}
