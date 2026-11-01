import { createContext, useContext } from 'react';

/** What the app can do to its own startup gate from deep inside a screen. */
export interface GateValue {
  /** Shows onboarding again, for example after the account is deleted. */
  resetToOnboarding: () => void;
}

export const GateContext = createContext<GateValue | null>(null);

export function useGate(): GateValue {
  const ctx = useContext(GateContext);
  if (!ctx) throw new Error('useGate must be used inside the root layout');
  return ctx;
}
