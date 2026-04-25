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
// Sound event → Snd.SOUNDS key mapping (all 15 events)
// ---------------------------------------------------------------------------

export const SOUND_MAP: Record<string, string> = {
  TAP:          'TAP',
  BUTTON:       'BUTTON',
  DISABLED:     'DISABLED',
  TOGGLE_ON:    'TOGGLE_ON',
  TOGGLE_OFF:   'TOGGLE_OFF',
  SLIDE:        'SLIDE',
  SELECT:       'SELECT',
  OPEN:         'OPEN',
  CLOSE:        'CLOSE',
  PROCESSING:   'PROCESSING',
  TYPE:         'TYPE',
  NOTIFICATION: 'NOTIFICATION',
  CAUTION:      'CAUTION',
  CELEBRATION:  'CELEBRATION',
  ALERT:        'ALERT',
};

// ---------------------------------------------------------------------------
// localStorage keys
// ---------------------------------------------------------------------------

const LS_ENABLED = 'memo_sound_enabled';
const LS_KIT     = 'memo_sound_kit';
const DEFAULT_KIT = 'SND02';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

export const SoundContext = createContext<SoundContextValue>({
  play:       () => {},
  enabled:    true,
  kit:        DEFAULT_KIT,
  setEnabled: () => {},
  setKit:     () => {},
});

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function SoundProvider({ children }: { children: ReactNode }) {
  // Read persisted preferences from localStorage (SSR-safe)
  const [enabled, setEnabledState] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const stored = localStorage.getItem(LS_ENABLED);
    return stored === null ? true : stored === 'true';
  });

  const [kit, setKitState] = useState<string>(() => {
    if (typeof window === 'undefined') return DEFAULT_KIT;
    return localStorage.getItem(LS_KIT) ?? DEFAULT_KIT;
  });

  // Holds the lazily-loaded Snd instance and the Snd class itself
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sndRef = useRef<any>(null);   // Snd instance
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SndRef = useRef<any>(null);   // Snd class (for SOUNDS / KITS constants)
  const loadedKitRef = useRef<string | null>(null);
  const loadingRef = useRef(false);
  // Sounds queued before the kit finishes loading
  const pendingRef = useRef<string[]>([]);

  // Load (or reload) the snd-lib kit
  const loadKit = useCallback(async (targetKit: string) => {
    if (typeof window === 'undefined') return;
    if (loadingRef.current) return;
    loadingRef.current = true;
    try {
      const mod = await import('snd-lib');
      const Snd = mod.default ?? mod;
      SndRef.current = Snd;

      if (!sndRef.current) {
        sndRef.current = new Snd();
      }

      const kitKey = (Snd.KITS as Record<string, unknown>)[targetKit];
      await sndRef.current.load(kitKey);
      loadedKitRef.current = targetKit;

      // Flush any sounds that were queued while loading
      const pending = pendingRef.current.splice(0);
      for (const sound of pending) {
        const soundKey = SOUND_MAP[sound];
        if (!soundKey) continue;
        const constant = (SndRef.current.SOUNDS as Record<string, unknown>)[soundKey];
        if (constant !== undefined) {
          try { sndRef.current.play(constant); } catch { /* ignore */ }
        }
      }
    } catch (err) {
      console.warn('[SoundProvider] Failed to load snd-lib:', err);
    } finally {
      loadingRef.current = false;
    }
  }, []);

  // Initialise on the first pointerdown (browser autoplay policy compliance)
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let initialised = false;

    const handleFirstPointer = () => {
      if (initialised) return;
      initialised = true;
      document.removeEventListener('pointerdown', handleFirstPointer);
      loadKit(kit);
    };

    document.addEventListener('pointerdown', handleFirstPointer);
    return () => {
      document.removeEventListener('pointerdown', handleFirstPointer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally run once on mount

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  const play = useCallback(
    (sound: string) => {
      if (!enabled) return;
      if (typeof window === 'undefined') return;

      // Kit still loading — queue the sound to play once ready
      if (!sndRef.current || !SndRef.current) {
        if (loadingRef.current) pendingRef.current.push(sound);
        return;
      }

      const soundKey = SOUND_MAP[sound];
      if (!soundKey) return;

      const constant = (SndRef.current.SOUNDS as Record<string, unknown>)[soundKey];
      if (constant === undefined) return;

      try {
        sndRef.current.play(constant);
      } catch (err) {
        console.warn('[SoundProvider] play() error:', err);
      }
    },
    [enabled],
  );

  const setEnabled = useCallback((v: boolean) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(LS_ENABLED, String(v));
    }
    setEnabledState(v);
  }, []);

  const setKit = useCallback(
    (newKit: string) => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(LS_KIT, newKit);
      }
      setKitState(newKit);

      // Reload the snd-lib instance with the new kit immediately
      if (typeof window !== 'undefined' && sndRef.current) {
        loadKit(newKit);
      }
    },
    [loadKit],
  );

  return (
    <SoundContext.Provider value={{ play, enabled, kit, setEnabled, setKit }}>
      {children}
    </SoundContext.Provider>
  );
}
