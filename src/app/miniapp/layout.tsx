'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/supabase/auth-context';
import { ScrollText, LayoutDashboard, Network, Settings, FileText } from 'lucide-react';
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
        safeAreaInset?: { top: number; bottom: number; left: number; right: number };
        contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
      };
    };
  }
}

const tabs = [
  { label: 'Feed', href: '/miniapp', Icon: ScrollText },
  { label: 'Dashboard', href: '/miniapp/dashboard', Icon: LayoutDashboard },
  { label: 'Graph', href: '/miniapp/graph', Icon: Network },
  { label: 'Reports', href: '/miniapp/reports', Icon: FileText },
  { label: 'Settings', href: '/miniapp/settings', Icon: Settings },
];

function MiniAppContent({ children }: { children: React.ReactNode }) {
  const { setAccessToken } = useAuth();
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const pathname = usePathname();
  const [topInset, setTopInset] = useState(0);
  const [bottomInset, setBottomInset] = useState(0);
  const [locked, setLocked] = useState(false);
  const didInit = useRef(false);

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

        // Check passcode lock on every open
        if (!didInit.current) {
          didInit.current = true;
          if (shouldLock()) setLocked(true);
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
      style={{ '--bottom-inset': `${bottomInset}px`, '--tab-bar-h': '84px' } as React.CSSProperties}
    >
      {/* Lock screen */}
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
        style={{ paddingBottom: `calc(var(--tab-bar-h) + var(--bottom-inset))` }}
      >
        {children}
      </main>

      <nav
        className="fixed left-0 right-0 z-50 flex justify-center px-4"
        style={{ bottom: `calc(var(--bottom-inset) + 12px)` }}
      >
        <div
          className="flex w-full max-w-sm items-center justify-around rounded-full px-3 shadow-drawer backdrop-blur-xl"
          style={{
            height: 60,
            background: 'linear-gradient(180deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0.95) 100%)',
            border: '1px solid rgba(148, 163, 184, 0.15)',
          }}
        >
          {tabs.map(({ label, href, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center justify-center gap-1 py-2 transition-all duration-200 ease-out active:scale-95"
              >
                <div className={cn(
                  'flex items-center justify-center rounded-lg transition-all duration-200',
                  isActive ? 'bg-primary/15' : 'bg-transparent'
                )}>
                  <Icon
                    size={isActive ? 22 : 20}
                    strokeWidth={isActive ? 2.2 : 1.5}
                    className={cn(
                      'transition-all duration-200',
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    )}
                  />
                </div>
                <span className={cn(
                  'text-[10px] font-medium leading-none transition-colors duration-200',
                  isActive ? 'text-foreground' : 'text-muted-foreground'
                )}>
                  {label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export default function MiniAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <MiniAppContent>{children}</MiniAppContent>
    </AuthProvider>
  );
}
