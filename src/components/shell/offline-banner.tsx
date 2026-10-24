'use client';

import { useEffect, useState } from 'react';
import { WifiOff } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useI18n } from '@/lib/i18n/context';

export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);
  return online;
}

export function OfflineBanner() {
  const { t } = useI18n();
  const online = useOnline();
  if (online) return null;
  // Alert carries role="alert", so screen readers announce it when it appears.
  return (
    <Alert className="rounded-none border-x-0 border-t-0">
      <WifiOff className="size-4" />
      <AlertTitle>{t('shell.offline_title')}</AlertTitle>
      <AlertDescription>{t('shell.offline')}</AlertDescription>
    </Alert>
  );
}
