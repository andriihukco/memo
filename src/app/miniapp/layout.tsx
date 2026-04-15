'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AuthProvider, useAuth } from '@/lib/supabase/auth-context';
import { ScrollText, LayoutDashboard, Network, Settings, FileText } from 'lucide-react';
import { PasscodeScreen } from '@/components/ui/passcode-screen';
import { getPasscodeHash, shouldLock, touchLastActive } from '@/lib/passcode';


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
  { label: 'Стрічка',  href: '/miniapp',           Icon: ScrollText },
  { label: 'Дашборд',  href: '/miniapp/dashboard',  Icon: LayoutDashboard },
  { label: 'Граф',     href: '/miniapp/graph',       Icon: Network },
  { label: 'Звіти',    href: '/miniapp/reports',     Icon: FileText },
  { label: 'Профіль',  href: '/miniapp/settings',    Icon: Settings },
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
        <div className="text-center">
          <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-muted border-t-foreground" />
          <p className="text-sm text-muted-foreground">Завантаження...</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="flex h-screen items-center justify-center bg-background px-6">
        <div className="text-center">
          <p className="mb-1 text-base font-medium">Не вдалося увійти</p>
          <p className="text-sm text-muted-foreground">{errorMsg}</p>
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
        className="fixed left-0 right-0 z-50 px-4"
        style={{ bottom: `calc(var(--bottom-inset) + 12px)` }}
      >
        <div
          className="flex items-center justify-around rounded-full bg-[#0f1b2d] px-3 shadow-2xl shadow-black/40"
          style={{ height: 60 }}
        >
          {tabs.map(({ label, href, Icon }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2 transition-all"
              >
                <Icon
                  size={isActive ? 22 : 20}
                  strokeWidth={isActive ? 2.2 : 1.5}
                  className={isActive ? 'text-white' : 'text-slate-400'}
                />
                <span className={`text-[10px] font-medium leading-none ${isActive ? 'text-white' : 'text-slate-400'}`}>
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
