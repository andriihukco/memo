'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getBrowserAuthClient } from '@/lib/supabase/browser';

/**
 * Start without an account: a Supabase anonymous session. The profile is created by the
 * web-accounts trigger (migration 20240001000025). The user can link an email or Google later.
 */
export function StartAnonymously() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const supabase = getBrowserAuthClient();
    if (!supabase) return setError('Sign-in is not configured on this server.');
    setBusy(true);
    setError(null);
    const { error: authErr } = await supabase.auth.signInAnonymously();
    if (authErr) {
      setBusy(false);
      setError('Start without an account is not available right now. Sign in with email or Google instead.');
      return;
    }
    router.replace('/miniapp');
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={start} disabled={busy} className="min-h-11">
        {busy ? 'Starting…' : 'Start without an account'}
      </Button>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
