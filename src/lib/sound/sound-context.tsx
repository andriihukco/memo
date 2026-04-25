'use client';

import React, {
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SoundContextValue {
  play: (sound: string) => void;
  enabled: boolean;
  kit: string;
  setEnabled: (v: boolean) => void;
  setKit: (kit: string) => void;
}

// ---------------------------------------------------------------------------
// Sine-wave sound definitions
// Each sound is a sequence of { freq, duration, volume, type } notes
// ---------------------------------------------------------------------------

type OscType = 'sine' | 'triangle' | 'square';

interface Note {
  freq: number;
  duration: number;   // seconds
  volume: number;     // 0–1
  type?: OscType;
  delay?: number;     // seconds offset from start
  attack?: number;    // seconds
  decay?: number;     // seconds
}

type SoundDef = Note[];

const SINE_SOUNDS: Record<string, SoundDef> = {
  TAP: [
    { freq: 880, duration: 0.04, volume: 0.12, type: 'sine', attack: 0.002, decay: 0.03 },
  ],
  BUTTON: [
    { freq: 660, duration: 0.06, volume: 0.18, type: 'sine', attack: 0.003, decay: 0.05 },
    { freq: 880, duration: 0.06, volume: 0.14, type: 'sine', delay: 0.04, attack: 0.002, decay: 0.05 },
  ],
  DISABLED: [
    { freq: 220, duration: 0.08, volume: 0.12, type: 'sine', attack: 0.005, decay: 0.07 },
  ],
  TOGGLE_ON: [
    { freq: 523, duration: 0.07, volume: 0.16, type: 'sine', attack: 0.003, decay: 0.06 },
    { freq: 784, duration: 0.07, volume: 0.16, type: 'sine', delay: 0.06, attack: 0.003, decay: 0.06 },
  ],
  TOGGLE_OFF: [
    { freq: 784, duration: 0.07, volume: 0.16, type: 'sine', attack: 0.003, decay: 0.06 },
    { freq: 523, duration: 0.07, volume: 0.14, type: 'sine', delay: 0.06, attack: 0.003, decay: 0.06 },
  ],
  SLIDE: [
    { freq: 440, duration: 0.05, volume: 0.10, type: 'sine', attack: 0.002, decay: 0.04 },
    { freq: 660, duration: 0.05, volume: 0.10, type: 'sine', delay: 0.04, attack: 0.002, decay: 0.04 },
  ],
  SELECT: [
    { freq: 740, duration: 0.06, volume: 0.14, type: 'sine', attack: 0.002, decay: 0.05 },
  ],
  OPEN: [
    { freq: 523, duration: 0.06, volume: 0.14, type: 'sine', attack: 0.003, decay: 0.05 },
    { freq: 659, duration: 0.06, volume: 0.14, type: 'sine', delay: 0.05, attack: 0.003, decay: 0.05 },
    { freq: 784, duration: 0.08, volume: 0.12, type: 'sine', delay: 0.10, attack: 0.003, decay: 0.07 },
  ],
  CLOSE: [
    { freq: 784, duration: 0.06, volume: 0.12, type: 'sine', attack: 0.002, decay: 0.05 },
    { freq: 523, duration: 0.08, volume: 0.10, type: 'sine', delay: 0.05, attack: 0.003, decay: 0.07 },
  ],
  PROCESSING: [
    { freq: 440, duration: 0.05, volume: 0.10, type: 'sine', attack: 0.002, decay: 0.04 },
    { freq: 494, duration: 0.05, volume: 0.10, type: 'sine', delay: 0.07, attack: 0.002, decay: 0.04 },
    { freq: 523, duration: 0.05, volume: 0.10, type: 'sine', delay: 0.14, attack: 0.002, decay: 0.04 },
  ],
  TYPE: [
    { freq: 1047, duration: 0.03, volume: 0.07, type: 'sine', attack: 0.001, decay: 0.025 },
  ],
  NOTIFICATION: [
    { freq: 880, duration: 0.08, volume: 0.20, type: 'sine', attack: 0.005, decay: 0.07 },
    { freq: 1047, duration: 0.10, volume: 0.18, type: 'sine', delay: 0.10, attack: 0.005, decay: 0.09 },
  ],
  CAUTION: [
    { freq: 330, duration: 0.10, volume: 0.20, type: 'sine', attack: 0.005, decay: 0.09 },
    { freq: 277, duration: 0.12, volume: 0.18, type: 'sine', delay: 0.12, attack: 0.005, decay: 0.11 },
  ],
  CELEBRATION: [
    { freq: 523, duration: 0.07, volume: 0.18, type: 'sine', attack: 0.003, decay: 0.06 },
    { freq: 659, duration: 0.07, volume: 0.18, type: 'sine', delay: 0.07, attack: 0.003, decay: 0.06 },
    { freq: 784, duration: 0.07, volume: 0.18, type: 'sine', delay: 0.14, attack: 0.003, decay: 0.06 },
    { freq: 1047, duration: 0.12, volume: 0.20, type: 'sine', delay: 0.21, attack: 0.005, decay: 0.11 },
    { freq: 1319, duration: 0.14, volume: 0.16, type: 'sine', delay: 0.30, attack: 0.005, decay: 0.13 },
  ],
  ALERT: [
    { freq: 880, duration: 0.08, volume: 0.22, type: 'sine', attack: 0.003, decay: 0.07 },
    { freq: 880, duration: 0.08, volume: 0.22, type: 'sine', delay: 0.12, attack: 0.003, decay: 0.07 },
    { freq: 1047, duration: 0.12, volume: 0.20, type: 'sine', delay: 0.24, attack: 0.005, decay: 0.11 },
  ],
};

// ---------------------------------------------------------------------------
// Web Audio sine synthesizer
// ---------------------------------------------------------------------------

function playSineSounds(ctx: AudioContext, def: SoundDef) {
  const now = ctx.currentTime;
  for (const note of def) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = note.type ?? 'sine';
    osc.frequency.setValueAtTime(note.freq, now);

    const start = now + (note.delay ?? 0);
    const attack = note.attack ?? 0.003;
    const decay = note.decay ?? note.duration * 0.8;
    const end = start + note.duration;

    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(note.volume, start + attack);
    gain.gain.linearRampToValueAtTime(0, start + decay);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(end + 0.01);
  }
}

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const LS_ENABLED = 'memo_sound_enabled';
const LS_KIT     = 'memo_sound_kit';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const SoundContext = createContext<SoundContextValue>({
  play:       () => {},
  enabled:    true,
  kit:        'SINE',
  setEnabled: () => {},
  setKit:     () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SoundProvider({ children }: { children: ReactNode }) {
  const [enabled, setEnabledState] = useState<boolean>(true);
  const [kit, setKitState] = useState<string>('SINE');

  // Sync persisted preferences from localStorage after mount
  useEffect(() => {
    const storedEnabled = localStorage.getItem(LS_ENABLED);
    if (storedEnabled !== null) setEnabledState(storedEnabled === 'true');
    // Always use SINE — ignore any stored kit value
    localStorage.setItem(LS_KIT, 'SINE');
  }, []);

  // AudioContext — created lazily on first user interaction
  const audioCtxRef = useRef<AudioContext | null>(null);
  const resumedRef = useRef(false);

  const getCtx = useCallback((): AudioContext | null => {
    if (typeof window === 'undefined') return null;
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      } catch {
        return null;
      }
    }
    return audioCtxRef.current;
  }, []);

  // Resume AudioContext on first pointer (browser autoplay policy)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const resume = async () => {
      if (resumedRef.current) return;
      resumedRef.current = true;
      const ctx = getCtx();
      if (ctx && ctx.state === 'suspended') {
        try { await ctx.resume(); } catch { /* ignore */ }
      }
    };
    document.addEventListener('pointerdown', resume, { once: true });
    return () => document.removeEventListener('pointerdown', resume);
  }, [getCtx]);

  const play = useCallback(
    (sound: string) => {
      if (!enabled) return;
      if (typeof window === 'undefined') return;

      const def = SINE_SOUNDS[sound];
      if (!def) return;

      const ctx = getCtx();
      if (!ctx) return;

      // Resume if suspended (e.g. after page visibility change)
      if (ctx.state === 'suspended') {
        ctx.resume().then(() => playSineSounds(ctx, def)).catch(() => {});
      } else {
        try { playSineSounds(ctx, def); } catch { /* ignore */ }
      }
    },
    [enabled, getCtx],
  );

  const setEnabled = useCallback((v: boolean) => {
    if (typeof window !== 'undefined') localStorage.setItem(LS_ENABLED, String(v));
    setEnabledState(v);
  }, []);

  const setKit = useCallback((_newKit: string) => {
    // Only SINE is supported — ignore other kit requests
    if (typeof window !== 'undefined') localStorage.setItem(LS_KIT, 'SINE');
    setKitState('SINE');
  }, []);

  return (
    <SoundContext.Provider value={{ play, enabled, kit, setEnabled, setKit }}>
      {children}
    </SoundContext.Provider>
  );
}
