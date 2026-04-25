'use client';

import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { useAuth } from '@/lib/supabase/auth-context';

export interface ReportGenerationState {
  generating: boolean;
  pendingLabel: string | null;
  genError: string | null;
  lastParams: { periodType: string; from?: Date; to?: Date } | null;
  startGeneration: (periodType: string, from?: Date, to?: Date) => void;
  clearError: () => void;
  /** Called by the reports page after it mounts to reload its list */
  onComplete: (() => void) | null;
  setOnComplete: (fn: (() => void) | null) => void;
}

const ReportGenerationContext = createContext<ReportGenerationState>({
  generating: false,
  pendingLabel: null,
  genError: null,
  lastParams: null,
  startGeneration: () => {},
  clearError: () => {},
  onComplete: null,
  setOnComplete: () => {},
});

export function useReportGeneration() {
  return useContext(ReportGenerationContext);
}

const PERIOD_LABELS: Record<string, string> = {
  daily: 'Сьогодні', weekly: '7 днів', monthly: 'Місяць', custom: 'Звіт',
};

export function ReportGenerationProvider({ children }: { children: React.ReactNode }) {
  const { accessToken } = useAuth();
  const [generating, setGenerating] = useState(false);
  const [pendingLabel, setPendingLabel] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastParams, setLastParams] = useState<{ periodType: string; from?: Date; to?: Date } | null>(null);
  const onCompleteRef = useRef<(() => void) | null>(null);

  const setOnComplete = useCallback((fn: (() => void) | null) => {
    onCompleteRef.current = fn;
  }, []);

  const startGeneration = useCallback(async (periodType: string, from?: Date, to?: Date) => {
    if (generating || !accessToken) return;

    setLastParams({ periodType, from, to });
    setGenerating(true);
    setPendingLabel(PERIOD_LABELS[periodType] ?? 'Ретроспектива');
    setGenError(null);

    try {
      const body: Record<string, unknown> = { period_type: periodType };
      if (from) body.from = from.toISOString();
      if (to) body.to = to.toISOString();

      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (res.status === 402) {
        setGenError(`Ліміт ретроспектив вичерпано. Перейди на вищий план.`);
      } else if (!res.ok) {
        setGenError(data.error ?? `Помилка ${res.status}`);
      } else {
        // Notify the reports page to reload its list (if it's mounted)
        onCompleteRef.current?.();
      }
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Невідома помилка');
    } finally {
      setGenerating(false);
      setPendingLabel(null);
    }
  }, [generating, accessToken]);

  return (
    <ReportGenerationContext.Provider value={{
      generating,
      pendingLabel,
      genError,
      lastParams,
      startGeneration,
      clearError: () => setGenError(null),
      onComplete: onCompleteRef.current,
      setOnComplete,
    }}>
      {children}
    </ReportGenerationContext.Provider>
  );
}
