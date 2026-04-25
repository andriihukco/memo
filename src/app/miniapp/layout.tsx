'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/supabase/auth-context';
import { Icon } from '@/components/ui/icon';
import { SoundProvider } from '@/lib/sound/sound-context';
import { useSound } from '@/lib/sound/use-sound';
import { PasscodeScreen } from '@/components/ui/passcode-screen';
import { getPasscodeHash, shouldLock, touchLastActive, removePasscode } from '@/lib/passcode';
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

interface Slide {
  emoji: string;
  title: string;
  body: string;
  bg: string;
  textColor?: string;
  isFinal?: boolean;
  showPrivacyBadge?: boolean;
}

const SLIDES: Slide[] = [
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
    emoji: '🔐',
    title: 'Твої дані захищені',
    body: 'Всі записи шифруються на твоєму пристрої перед збереженням. Навіть ми не можемо їх прочитати. Твоя приватність — наш пріоритет.',
    bg: 'from-emerald-950 to-slate-950',
    textColor: 'text-emerald-400',
    showPrivacyBadge: true,
  },
  {
    emoji: '⭐',
    title: 'Підтримай проект',
    body: 'Базові функції безкоштовні назавжди. Stars Pro відкриває розширену аналітику та рекомендації.',
    bg: 'from-yellow-950 to-slate-950',
    isFinal: true,
  },
];

// ── OnboardingPaywall ─────────────────────────────────────────────────────────

interface OnboardingPaywallProps {
  finish: () => void;
  play: (event: string) => void;
}

function OnboardingPaywall({ finish, play }: OnboardingPaywallProps) {
  const { accessToken } = useAuth();
  const [visible, setVisible] = useState(false);
  const [paying, setPaying] = useState<'stars_basic' | 'stars_pro' | null>(null);

  // Trigger slide-up animation after mount
  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  const handleContinueFree = () => {
    play('CLOSE');
    finish();
  };

  const handleSubscribe = async (tier: 'stars_basic' | 'stars_pro') => {
    play('BUTTON');
    if (!accessToken) {
      // Auth not ready yet — finish onboarding and let them subscribe from settings
      finish();
      return;
    }

    setPaying(tier);
    try {
      // Fetch profile id first
      const profileRes = await fetch('/api/profile', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!profileRes.ok) throw new Error('no profile');
      const { profile } = await profileRes.json();

      const res = await fetch('/api/stars/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId: profile.id, tier }),
      });
      const data = await res.json();
      if (!data.ok || !data.invoiceLink) throw new Error('no invoice');

      const tg = window.Telegram?.WebApp;
      if (!tg?.openInvoice) throw new Error('no tg');

      tg.openInvoice(data.invoiceLink, () => {
        setPaying(null);
        finish(); // always finish onboarding after payment attempt
      });
    } catch {
      setPaying(null);
      finish();
    }
  };

  const plans = [
    {
      tier: 'stars_basic' as const,
      emoji: '🌟',
      name: 'Basic',
      price: '250 ⭐ / міс',
      features: ['До 2 000 записів', 'AI ретроспективи', 'Трекінг цілей', '15 кастомних віджетів'],
      recommended: true,
    },
    {
      tier: 'stars_pro' as const,
      emoji: '💎',
      name: 'Pro',
      price: '500 ⭐ / міс',
      features: ['Необмежені записи', 'Пріоритетна обробка', 'Експорт даних', 'Вся аналітика'],
      recommended: false,
    },
  ];

  return (
    <div
      className="fixed inset-0 z-[101] flex flex-col bg-gradient-to-b from-yellow-950 to-slate-950"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 320ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}
    >
      {/* Scrollable content */}
      <div className="flex flex-1 flex-col overflow-y-auto px-5 pb-4 pt-12">
        <h1 className="mb-1 text-[26px] font-bold leading-tight text-white">Обери свій план</h1>
        <p className="mb-5 text-[14px] text-white/50">Базові функції безкоштовні назавжди</p>

        {/* Free tier row */}
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-xl">⭐</span>
          <div className="flex-1">
            <p className="text-[14px] font-semibold text-white">Безкоштовний</p>
            <p className="text-[12px] text-white/40">До 100 записів · 3 віджети · Базові функції</p>
          </div>
          <span className="text-[13px] text-white/40">Безкоштовно</span>
        </div>

        {/* Paid plan cards */}
        <div className="flex flex-col gap-3">
          {plans.map((plan) => (
            <div
              key={plan.tier}
              className={cn(
                'relative rounded-2xl border px-4 py-3.5',
                plan.recommended
                  ? 'border-yellow-400/50 bg-yellow-950/50'
                  : 'border-white/10 bg-white/5'
              )}
            >
              {plan.recommended && (
                <span className="absolute -top-2.5 right-3 rounded-full bg-yellow-400 px-2.5 py-0.5 text-[10px] font-semibold text-slate-950">
                  Рекомендовано
                </span>
              )}
              <div className="mb-2.5 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl leading-none">{plan.emoji}</span>
                  <span className="text-[15px] font-semibold text-white">{plan.name}</span>
                </div>
                <span className="text-[13px] text-white/60">{plan.price}</span>
              </div>
              <ul className="mb-3 space-y-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-1.5 text-[12px] text-white/50">
                    <span className="text-[10px] text-yellow-400/80">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => handleSubscribe(plan.tier)}
                disabled={paying !== null}
                className={cn(
                  'w-full rounded-xl py-2.5 text-[14px] font-semibold transition-all active:scale-95 disabled:opacity-60',
                  plan.recommended
                    ? 'bg-yellow-400 text-slate-950'
                    : 'bg-white/10 text-white'
                )}
              >
                {paying === plan.tier ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                    Відкриваємо...
                  </span>
                ) : (
                  `Підписатися — ${plan.price}`
                )}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Continue free CTA */}
      <div className="px-5 pb-10 pt-2">
        <button
          onClick={handleContinueFree}
          className="w-full py-3 text-[14px] text-white/40 active:text-white/60"
        >
          Продовжити безкоштовно →
        </button>
      </div>
    </div>
  );
}

// ── OnboardingOverlay ─────────────────────────────────────────────────────────

function OnboardingOverlay({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const isScrolling = useRef<boolean | null>(null);
  const [dragOffset, setDragOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const { play } = useSound();

  const finish = () => {
    play('CELEBRATION');
    setVisible(false);
    setTimeout(onDone, 350);
  };

  const openPaywall = () => {
    setShowPaywall(true);
  };

  const goNext = () => {
    if (index < SLIDES.length - 1) {
      play('SLIDE');
      setIndex(i => i + 1);
    } else {
      // Final slide CTA → show paywall instead of finishing directly
      openPaywall();
    }
  };
  const goPrev = () => {
    if (index > 0) {
      play('SLIDE');
      setIndex(i => i - 1);
    }
  };

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
    <>
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
          onClick={() => { play('CLOSE'); openPaywall(); }}
          className="absolute right-5 top-14 text-sm text-white/40 active:text-white/70"
        >
          Пропустити
        </button>

        {/* Content */}
        <div
          className="relative flex flex-1 flex-col items-center justify-center text-center"
          style={{
            transform: `translateX(${dragging ? dragOffset * 0.2 : 0}px)`,
            transition: dragging ? 'none' : 'transform 0.35s cubic-bezier(0.32, 0.72, 0, 1)',
          }}
        >
          <div className="mb-8 text-8xl leading-none select-none">{slide.emoji}</div>
          <h1 className={cn('mb-4 text-[28px] font-bold leading-tight', slide.textColor ?? 'text-white')}>{slide.title}</h1>
          <p className="max-w-xs text-[15px] leading-relaxed text-white/60">{slide.body}</p>

          {/* Privacy badge — removed */}
        </div>

        {/* Dots */}
        <div className="mb-8 flex gap-1.5 items-center">
          {SLIDES.map((_, i) => (
            <button key={i} onClick={() => { play('SELECT'); setIndex(i); }}
              style={{ minWidth: 0, minHeight: 0, width: i === index ? 16 : 6, height: 6 }}
              className={cn('rounded-full transition-all duration-300', i === index ? 'bg-white' : 'bg-white/30')}
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
            {slide.isFinal ? 'Почати безкоштовно →' : 'Далі →'}
          </button>
          {index > 0 && (
            <button onClick={goPrev} className="w-full py-2 text-sm text-white/40 active:text-white/70">
              ← Назад
            </button>
          )}
        </div>
      </div>

      {/* Paywall overlay — rendered on top of the onboarding slide */}
      {showPaywall && (
        <OnboardingPaywall finish={finish} play={play} />
      )}
    </>
  );
}

// ── Pill Tab Bar ──────────────────────────────────────────────────────────────

const tabs = [
  { label: 'Стрічка',  href: '/miniapp',            icon: 'contract' },
  { label: 'Віджети',  href: '/miniapp/dashboard',   icon: 'dashboard' },
  { label: 'Графік',   href: '/miniapp/graph',        icon: 'hub' },
  { label: 'Інсайти',  href: '/miniapp/reports',      icon: 'wb_incandescent' },
  { label: 'Меню',    href: '/miniapp/settings',     icon: 'menu' },
];

const ACTIVE_COLOR = '#4797FF';
const INACTIVE_COLOR = '#335B7E';

function PillTabBar({ pathname, bottomInset }: { pathname: string; bottomInset: number }) {
  const { play } = useSound();
  const [sheetsOpen, setSheetsOpen] = useState(false);

  // Hide tab bar when any bottom sheet is open
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setSheetsOpen(document.body.hasAttribute('data-sheets-open'));
    });
    observer.observe(document.body, { attributes: true, attributeFilter: ['data-sheets-open'] });
    return () => observer.disconnect();
  }, []);

  if (sheetsOpen) return null;

  return (
    <nav
      role="navigation"
      aria-label="Головна навігація"
      style={{
        position: 'fixed',
        bottom: bottomInset + 10,
        left: '50%',
        transform: 'translateX(-50%)',
        borderRadius: 48,
        background: '#1F2234',
        width: 'min(calc(100vw - 16px), 380px)',
        height: 64,
        zIndex: 50,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '0 16px',
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
            onClick={() => play(isActive ? 'SELECT' : 'SLIDE')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 2,
              minWidth: 44,
              minHeight: 44,
              textDecoration: 'none',
              flex: 1,
            }}
          >
            <Icon
              name={icon}
              size={24}
              filled={isActive}
              style={{ color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR }}
            />
            <span
              style={{
                fontFamily: "'Mulish', sans-serif",
                fontWeight: 500,
                fontSize: 11,
                lineHeight: '14px',
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

const rootPaths = ['/miniapp', '/miniapp/dashboard', '/miniapp/graph', '/miniapp/reports', '/miniapp/settings'];

function MiniAppContent({ children }: { children: React.ReactNode }) {
  const { setAccessToken } = useAuth();
  const { play } = useSound();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const isSubPage = !rootPaths.includes(pathname);
  const [topInset, setTopInset] = useState(0);
  const [bottomInset, setBottomInset] = useState(0);
  const [locked, setLocked] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showRenewalBanner, setShowRenewalBanner] = useState(false);
  const didInit = useRef(false);

  // Pill tab bar height: 64px tall + 10px bottom offset + bottomInset
  const tabBarH = 64 + 10 + bottomInset;

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
          // Use sessionStorage so lock check only fires once per browser session,
          // not on every navigation that causes layout remount
          if (!sessionStorage.getItem('memo_session_init')) {
            sessionStorage.setItem('memo_session_init', '1');
            if (shouldLock()) setLocked(true);
          }
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
          // User was removed from DB — clear all local state so they get a clean slate
          if (res.status === 401 || res.status === 403 || res.status === 404) {
            removePasscode();
            localStorage.removeItem('memo_onboarding_done');
            localStorage.removeItem('memo_renewal_banner_shown_date');
          }
          throw new Error(data.error ?? `Auth failed (${res.status})`);
        }

        const { access_token } = await res.json();
        setAccessToken(access_token);

        // Check subscription expiry and show renewal banner if needed
        const profileRes = await fetch('/api/profile', {
          headers: { Authorization: `Bearer ${access_token}` },
        });
        if (profileRes.ok) {
          const { profile } = await profileRes.json();
          if (
            profile?.subscription_ends_at &&
            new Date(profile.subscription_ends_at) < new Date() &&
            profile?.subscription_tier !== 'free'
          ) {
            const today = new Date().toISOString().slice(0, 10);
            if (localStorage.getItem('memo_renewal_banner_shown_date') !== today) {
              setShowRenewalBanner(true);
            }
          }
        }

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

  const dismissRenewalBanner = () => {
    const today = new Date().toISOString().slice(0, 10);
    localStorage.setItem('memo_renewal_banner_shown_date', today);
    setShowRenewalBanner(false);
  };

  if (status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="text-center animate-fadeIn">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
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

      {isSubPage && (
        <button
          onClick={() => { router.back(); play('SLIDE'); }}
          className="fixed top-4 left-4 z-50 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-muted/80 backdrop-blur-sm text-foreground"
          aria-label="Назад"
        >
          <Icon name="arrow_back" size={24} />
        </button>
      )}

      <main
        className="relative flex-1 overflow-y-auto"
        style={{ paddingBottom: `var(--tab-bar-h)` }}
        onClick={(e) => {
          // Play TAP on empty area clicks (not on interactive elements)
          const target = e.target as HTMLElement;
          const isInteractive = target.closest('button, a, input, textarea, select, [role="button"], [role="switch"]');
          if (!isInteractive) play('TAP');
        }}
      >
        {children}
      </main>

      <PillTabBar pathname={pathname} bottomInset={bottomInset} />

      {/* Renewal banner — shown once per day when subscription has expired */}
      {showRenewalBanner && (
        <div
          className="fixed left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-amber-950/90 border-t border-amber-400/30 backdrop-blur-sm"
          style={{
            bottom: `calc(var(--tab-bar-h, 84px) + var(--bottom-inset, 0px))`,
          }}
        >
          <p className="flex-1 text-[13px] text-amber-200 leading-snug">
            Підписка закінчилась. Поновіть для продовження доступу.
          </p>
          <button
            onClick={() => router.push('/miniapp/subscriptions')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-full bg-amber-400 px-3 text-[13px] font-semibold text-slate-950 shrink-0"
            aria-label="Поновити підписку"
          >
            Поновити
          </button>
          <button
            onClick={dismissRenewalBanner}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-amber-400/70 shrink-0"
            aria-label="Закрити банер"
          >
            ×
          </button>
        </div>
      )}
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
