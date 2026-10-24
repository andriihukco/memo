'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { tg } from '@/lib/telegram';

/** Inside Telegram, shows the native BackButton wired to browser history. Outside it is a no-op; PageHeader renders a chevron. */
export function useBack(enabled: boolean): void {
  const router = useRouter();
  useEffect(() => {
    const bb = tg()?.BackButton;
    if (!enabled || !bb) return;
    const onBack = () => router.back();
    bb.onClick(onBack);
    bb.show();
    return () => {
      bb.offClick(onBack);
      bb.hide();
    };
  }, [enabled, router]);
}
