'use client';

import { useEffect, useState } from 'react';
import { LockOpen } from 'lucide-react';
import { getPasscodeHash } from '@/lib/passcode';

export function LockButton() {
  const [hasPasscode, setHasPasscode] = useState(false);
  useEffect(() => { setHasPasscode(!!getPasscodeHash()); }, []);
  if (!hasPasscode) return null;
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent('memo:lock'))}
      className="ml-1.5 flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground/40 transition-colors hover:text-muted-foreground"
      aria-label="Заблокувати"
    >
      <LockOpen size={14} strokeWidth={1.8} />
    </button>
  );
}
