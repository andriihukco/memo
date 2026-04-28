'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@/components/ui/icon';
import { cn } from '@/lib/utils';
import { useSound } from '@/lib/sound/use-sound';
import { useI18n } from '@/lib/i18n/context';

interface PasscodeScreenProps {
  mode: 'enter' | 'set' | 'confirm';
  title?: string;
  subtitle?: string;
  /** Step context shown as small dots above title (e.g. current step 2 of 3) */
  stepCurrent?: number;
  stepTotal?: number;
  onSuccess: (pin: string) => void;
  onCancel?: () => void;
  expectedHash?: string;
  /** If true, shows a mismatch error immediately (controlled from parent) */
  mismatch?: boolean;
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
const PIN_LENGTH = 4;

export function PasscodeScreen({
  mode,
  title,
  subtitle,
  stepCurrent,
  stepTotal,
  onSuccess,
  onCancel,
  expectedHash,
  mismatch,
}: PasscodeScreenProps) {
  const [digits, setDigits] = useState<string[]>([]);
  const [shake, setShake] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const { play } = useSound();
  const { t } = useI18n();
  const didMount = useRef(false);

  // Show mismatch error from parent (confirm step)
  useEffect(() => {
    if (mismatch && !didMount.current) return;
    if (mismatch) {
      play('CAUTION');
      setError(t('miniapp.passcode.mismatch_error'));
      setShake(true);
      setTimeout(() => { setShake(false); setDigits([]); setError(''); }, 700);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mismatch]);

  useEffect(() => { didMount.current = true; }, []);

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
          setSuccess(true);
          setDigits(Array(PIN_LENGTH).fill('✓'));
          setTimeout(() => { setDigits([]); setSuccess(false); onSuccess(pin); }, 350);
        } else {
          play('CAUTION');
          setShake(true);
          setError(t('miniapp.passcode.wrong_error'));
          setTimeout(() => { setShake(false); setDigits([]); setError(''); }, 700);
        }
      } else {
        play('BUTTON');
        setDigits([]);
        onSuccess(pin);
      }
    }
  };

  const dotColor = success
    ? 'border-green-400 bg-green-400'
    : 'border-primary bg-primary';

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-8">

      {/* Step indicator */}
      {stepTotal && stepTotal > 1 && (
        <div className="absolute top-8 flex gap-1.5 items-center">
          {Array.from({ length: stepTotal }).map((_, i) => (
            <div
              key={i}
              className={cn(
                'rounded-full transition-all duration-300',
                i < (stepCurrent ?? 1)
                  ? 'w-5 h-1.5 bg-primary'
                  : 'w-1.5 h-1.5 bg-muted-foreground/30'
              )}
            />
          ))}
        </div>
      )}

      {/* Cancel */}
      {onCancel && (
        <button
          onClick={() => { play('CLOSE'); onCancel(); }}
          className="absolute left-5 top-5 flex h-[44px] w-[44px] items-center justify-center rounded-full bg-muted/60 text-muted-foreground"
          aria-label="Скасувати"
        >
          <Icon name="close" size={18} />
        </button>
      )}

      {/* Header */}
      <div className="mb-8 text-center">
        <h1 className={cn(
          'text-[22px] font-bold transition-colors duration-300',
          success ? 'text-green-400' : 'text-foreground'
        )}>
          {success ? '✓ ' : ''}{title ?? t('miniapp.passcode.default_title')}
        </h1>
        {subtitle && !error && (
          <p className="mt-1.5 text-[14px] text-muted-foreground">{subtitle}</p>
        )}
        {error && (
          <p className="mt-1.5 text-[14px] text-destructive animate-in fade-in duration-200">{error}</p>
        )}
      </div>

      {/* Dots */}
      <div className={cn('mb-12 flex gap-5', shake && 'animate-[shake_0.6s_ease-in-out]')}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-[18px] w-[18px] rounded-full border-2 transition-all duration-150',
              i < digits.length
                ? cn('scale-110', dotColor)
                : 'border-muted-foreground/30 bg-transparent'
            )}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid w-full max-w-[280px] grid-cols-3 gap-y-2 gap-x-3">
        {DIGITS.map((d, i) => (
          <motion.button
            key={i}
            onClick={() => handleDigit(d)}
            disabled={d === '' || success}
            whileTap={d !== '' ? { scale: 0.88 } : {}}
            transition={{ type: 'spring', stiffness: 500, damping: 22 }}
            className={cn(
              'flex h-[72px] w-[72px] items-center justify-center rounded-full text-[26px] font-medium mx-auto transition-colors',
              d === '' ? 'pointer-events-none opacity-0' :
              d === '⌫' ? 'bg-transparent text-muted-foreground active:bg-muted/50' :
              'bg-secondary/80 hover:bg-secondary active:bg-secondary/60'
            )}
            aria-label={d === '⌫' ? t('miniapp.passcode.backspace') : d === '' ? '' : d}
          >
            {d === '⌫' ? <Icon name="backspace" size={22} /> : d}
          </motion.button>
        ))}
      </div>
    </div>
  );
}
