'use client';

import { useState } from 'react';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useSound } from '@/lib/sound/use-sound';

interface PasscodeScreenProps {
  mode: 'enter' | 'set' | 'confirm';
  title?: string;
  subtitle?: string;
  onSuccess: (pin: string) => void;
  onCancel?: () => void;
  expectedHash?: string;
}

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin + 'memo-salt'));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  return (await hashPin(pin)) === hash;
}

export async function createPinHash(pin: string): Promise<string> {
  return hashPin(pin);
}

const DIGITS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export function PasscodeScreen({ mode, title, subtitle, onSuccess, onCancel, expectedHash }: PasscodeScreenProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const { play } = useSound();
  const PIN_LENGTH = 4;

  const handleDigit = async (d: string) => {
    if (d === '⌫') {
      play('CLOSE');
      setDigits((prev) => prev.slice(0, -1));
      setError('');
      return;
    }
    if (d === '') return;
    if (digits.length >= PIN_LENGTH) return;

    play('SELECT');
    const next = [...digits, d];
    setDigits(next);

    if (next.length === PIN_LENGTH) {
      const pin = next.join('');
      await new Promise((r) => setTimeout(r, 80));

      if (mode === 'enter' && expectedHash) {
        const ok = await verifyPin(pin, expectedHash);
        if (ok) {
          play('CELEBRATION');
          setDigits([]);
          onSuccess(pin);
        } else {
          play('CAUTION');
          setShake(true);
          setError('Невірний код');
          setTimeout(() => { setShake(false); setDigits([]); setError(''); }, 600);
        }
      } else {
        play('BUTTON');
        setDigits([]);
        onSuccess(pin);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-8">
      <div className="mb-8 text-center">
        <h1 className="text-xl font-semibold">{title ?? 'Введіть код'}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </div>

      {/* Dots */}
      <div className={cn('mb-10 flex gap-4', shake && 'animate-[shake_0.5s_ease-in-out]')}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-4 w-4 rounded-full border-2 transition-all duration-150',
              i < digits.length ? 'border-primary bg-primary scale-110' : 'border-muted-foreground/40 bg-transparent'
            )}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-3">
        {DIGITS.map((d, i) => (
          <button
            key={i}
            onClick={() => handleDigit(d)}
            disabled={d === ''}
            className={cn(
              'flex h-16 w-16 items-center justify-center rounded-full text-xl font-medium transition-all mx-auto',
              d === '' ? 'pointer-events-none' : 'bg-secondary hover:bg-secondary/70 active:scale-95',
              d === '⌫' && 'bg-transparent text-muted-foreground hover:bg-muted'
            )}
          >
            {d === '⌫' ? <Icon name="backspace" size={22} /> : d}
          </button>
        ))}
      </div>

      {onCancel && (
        <button onClick={() => { play('CLOSE'); onCancel(); }} className="mt-8 text-sm text-muted-foreground underline-offset-2 hover:underline">
          Скасувати
        </button>
      )}
    </div>
  );
}
