'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/supabase/auth-context';
import { Icon } from '@/components/ui/icon';
import { SoundProvider } from '@/lib/sound/sound-context';
import { useSound } from '@/lib/sound/use-sound';
import { PasscodeScreen } from '@/components/ui/passcode-screen';
import { getPasscodeHash, shouldLock, touchLastActive } from '@/lib/passcode';
import { cn } from '@/lib/utils';

declare global {
  interface Window {
    Telegram?: {
      WebApp: {
        initData: string;
        ready: () => void;
        expand: () => void;
        openInvoice: (url: string, callback: (status: string) => void) => void;
        safeAreaInset?: { top: number; bottom: number; left: number; right: number };
        contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
      };
    };
  }
}

// ── Onboarding ────────────────────────────────────────────────────────────────

const SLIDES = [
  {
    emoji: '📓',
    title: 'Твій особистий щоденник',
    body: 'Просто пиши або говори — Memo сам розбере що зберегти. Їжа, тренування, витрати, думки.',
    bg: 'from-indigo-950 to-slate-950',
  },
  {
    emoji: '🤖',
    title: 'AI, що тебе розуміє',
    body: 'Memo аналізує твої записи, рахує калорії та макроси, трекає активність і відповідає на питання про твоє минуле.',
    bg: 'from-violet-950 to-slate-950',
  },
  {
    emoji: '📊',
    title: 'Дашборд і графіки',
    body: 'Всі твої метрики в одному місці. Бачиш прогрес, патерни і тренди — без зайвих зусиль.',
    bg: 'from-blue-950 to-slate-950',
  },
  {
    emoji: '💡',
    title: 'Розумні рекомендації',
    body: 'Memo помічає якщо ти мало спиш, п\'єш забагато алкоголю або не вистачає білка — і підказує що змінити.',
    bg: 'from-amber-950 to-slate-950',
  },
  {
    emoji: '⭐',
    title: 'Підтримай проект',
    body: 'Базові функції безкоштовні назавжди. Stars Pro відкриває розширену аналітику та рекомендації.',
    bg: 'from-yellow-950 to-slate-950',
    isFinal: true,
  },
];

function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const startX = useRef(0);
  const startY = useRef(0);
  const isScrolling = useRef<boolean | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const finish = () => {
    setVisible(false);
    setTimeout(onDone, 350);
  };

  const goNext = () => { if (index < SLIDES.length - 1) setIndex(i => i + 1); else finish(); };
  const goPrev = () => { if (index > 0) setIndex(i => i - 1); };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    isScrolling.current = null;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (isScrolling.current === null) isScrolling.current = Math.abs(dy) > Math.abs(dx);
    if (isScrolling.current) return;
    e.preventDefault();
    setDragOffset(dx);
  };
  const onTouchEnd = () => {
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
        'fixed inset-0 z-[100] flex flex-col items-center justify-between bg-gradient-to-b px-6 pb-12 pt-16 transition-opacity duration-350',
        slide.bg,
        !visible && 'opacity-0 pointer-events-none'
      )}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Skip */}
      <button
        onClick={finish}
        className="absolute right-5 top-14 text-sm text-white/40 active:text-white/70"
      >
        Пропустити
      </button>

      {/* Content */}
      <div
        className="flex flex-1 flex-col items-center justify-center text-center"
        style={{
          transform: `translateX(${dragging ? dragOffset * 0.25 : 0}px)`,
          transition: dragging ? 'none' : 'transform 0.3s ease',
        }}
      >
        <div className="mb-8 text-8xl leading-none select-none">{slide.emoji}</div>
        <h1 className="mb-4 text-[28px] font-bold text-white leading-tight">{slide.title}</h1>
        <p className="max-w-xs text-[15px] leading-relaxed text-white/60">{slide.body}</p>
      </div>

      {/* Dots */}
      <div className="mb-8 flex gap-2">
        {SLIDES.map((_, i) => (
          <button key={i} onClick={() => setIndex(i)}
            className={cn('h-1.5 rounded-full transition-all duration-300', i === index ? 'w-6 bg-white' : 'w-1.5 bg-white/25')}
          />
        ))}
      </div>

      {/* CTA */}
      <div className="w-full max-w-xs space-y-3">
        <button
          onClick={goNext}
          className={cn(
            'w-full rounded-2xl py-4 text-base font-semibold text-slate-950 transition-all active:scale-95',
            slide.isFinal ? 'bg-yellow-400 shadow-lg shadow-yellow-400/30' : 'bg-white shadow-lg shadow-white/10'
          )}
        >
          {slide.isFinal ? '⭐ Почати безкоштовно' : 'Далі →'}
        </button>
        {index > 0 && (
          <button onClick={goPrev} className="w-full py-2 text-sm text-white/40 active:text-white/70">
            ← Назад
          </button>
        )}
      </div>
    </div>
  );
}

// ── Pill Tab Bar ──────────────────────────────────────────────────────────────

const tabs = [
  { label: 'Стрічка',  href: '/miniapp',           icon: 'contract' },
  { label: 'Віджети',  href: '/miniapp/dashboard',  icon: 'dashboard' },
  { label: 'Графік',   href: '/miniapp/graph',       icon: 'hub' },
  { label: 'Інсайти',  href: '/miniapp/reports',     icon: 'wb_incandescent' },
];

const ACTIVE_COLOR = '#4797FF';
const INACTIVE_COLOR = '#335B7E';

function PillTabBar({ pathname, bottomInset }: { pathname: string; bottomInset: number }) {
  const { play } = useSound();
  return (
    <nav
      role="navigation"
      aria-label="Головна навігація"
      style={{
        position: 'fixed',
        bottom: bottomInset + 12,
        left: '50%',
        transform: 'translateX(-50%)',
        borderRadius: 96,
        background: '#1F2234',
        width: 'min(calc(100vw - 32px), 456px)',
        minWidth: 'min(calc(100vw - 32px), 400px)',
        height: 100,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '16px 32px',
        gap: 32,
        boxSizing: 'border-box',
      }}
    >
      {tabs.map(({ label, href, icon }) => {
        const isActive = pathname === href;
        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => play('SLIDE')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 4,
              minWidth: 44,
              minHeight: 68,
              textDecoration: 'none',
              flex: 'none',
            }}
          >
            <Icon
              name={icon}
              size={40}
              filled={isActive}
              style={{ color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR }}
            />
            <span
              style={{
                fontFamily: "'Mulish', sans-serif",
                fontStyle: 'normal',
                fontWeight: 500,
                fontSize: 20,
                lineHeight: '24px',
                textAlign: 'center',
                color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR,
                whiteSpace: 'nowrap',
              }}
            >
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

// ── Main layout ───────────────────────────────────────────────────────────────

function MiniAppContent({ children }: { children: React.ReactNode }) {
  const { setAccessToken } = useAuth();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const pathname = usePathname();
  const [topInset, setTopInset] = useState(0);
  const [bottomInset, setBottomInset] = useState(0);
  const [locked, setLocked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const didInit = useRef(false);

  // Pill tab bar height: 100px tall + 12px bottom offset + bottomInset
  const tabBarH = 100 + 12 + bottomInset;

  useEffect(() => {
    async function init() {
      try {
        const tg = window.Telegram?.WebApp;
        tg?.ready();
        tg?.expand();

        const top = (tg?.contentSafeAreaInset?.top ?? 0) + (tg?.safeAreaInset?.top ?? 0);
        const bottom = tg?.safeAreaInset?.bottom ?? 0;
        setTopInset(top);
        setBottomInset(bottom);

        if (!didInit.current) {
          didInit.current = true;
          if (shouldLock()) setLocked(true);
          if (!localStorage.getItem('memo_onboarding_done')) {
            setShowOnboarding(true);
          }
        }

        const initData = tg?.initData ?? '';
        const res = await fetch('/api/auth/telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ initData }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? `Auth failed (${res.status})`);
        }

        const { access_token } = await res.json();
        setAccessToken(access_token);
        setStatus('ready');
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : 'Authentication failed');
        setStatus('error');
      }
    }

    init();
  }, [setAccessToken]);

  useEffect(() => {
    const handler = () => setLocked(true);
    window.addEventListener('memo:lock', handler);
    return () => window.removeEventListener('memo:lock', handler);
  }, []);

  const handleUnlock = () => {
    touchLastActive();
    setLocked(false);
  };

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center animate-fadeIn">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-muted border-t-primary shadow-glow" />
          <p className="text-[15px] text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6">
        <div className="text-center animate-fadeIn">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-destructive">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <p className="mb-1 text-[17px] font-semibold text-foreground">Sign In Failed</p>
          <p className="text-[15px] text-muted-foreground">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen flex-col bg-background"
      style={{
        '--bottom-inset': `${bottomInset}px`,
        '--tab-bar-h': `${tabBarH}px`,
      } as React.CSSProperties}
    >
      {showOnboarding && (
        <OnboardingOverlay onDone={() => {
          localStorage.setItem('memo_onboarding_done', '1');
          setShowOnboarding(false);
        }} />
      )}

      {locked && (
        <PasscodeScreen
          mode="enter"
          title="Memo"
          subtitle="Введіть код доступу"
          expectedHash={getPasscodeHash() ?? undefined}
          onSuccess={handleUnlock}
        />
      )}

      {/* Top spacer */}
      <div style={{ height: topInset }} />

      <main
        className="relative flex-1 overflow-y-auto"
        style={{ paddingBottom: `var(--tab-bar-h)` }}
      >
        {children}
      </main>

      <PillTabBar pathname={pathname} bottomInset={bottomInset} />
    </div>
  );
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <SoundProvider>
        <MiniAppContent>{children}</MiniAppContent>
      </SoundProvider>
    </AuthProvider>
  );
}
