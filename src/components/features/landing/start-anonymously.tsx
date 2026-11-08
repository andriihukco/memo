'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { getBrowserAuthClient } from '@/lib/supabase/browser';

/**
 * Start without an account: a Supabase anonymous session. The profile is created by the
 * web-accounts trigger (migration 20240001000025). The user can link an email or Google later.
 */
/** `disabled`: shown when the server says guest sign-in is turned off. */
type Labels = { label: string; busy: string; error: string; off: string; disabled?: string };

const DEFAULT_LABELS: Labels = {
  label: 'Start without an account',
  busy: 'Starting…',
  error: 'Start without an account is not available right now. Sign in with email or Google instead.',
  off: 'Sign-in is not configured on this server.',
};

/** `unavailable`: the reason guest mode is off on this server. The button is disabled and the reason shown under it. */
export function StartAnonymously({ labels = DEFAULT_LABELS, unavailable = null }: { labels?: Labels; unavailable?: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    const supabase = getBrowserAuthClient();
    if (!supabase) return setError(labels.off);
    setBusy(true);
    setError(null);
    const { error: authErr } = await supabase.auth.signInAnonymously();
    if (authErr) {
      setBusy(false);
      setError(/anonymous sign-ins are disabled/i.test(authErr.message) ? labels.disabled ?? labels.error : labels.error);
      return;
    }
    router.replace('/miniapp');
  }

  return (
    <div className="flex flex-col gap-2">
      <Button variant="outline" onClick={start} disabled={busy || !!unavailable} aria-describedby={unavailable ? 'guest-off' : undefined} className="min-h-11">
        {busy ? labels.busy : labels.label}
      </Button>
      {unavailable ? <p id="guest-off" className="text-sm text-muted-foreground">{unavailable}</p> : null}
      {error && !unavailable ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </div>
  );
}
