import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { API_URL } from './api';
import { supabase, supabaseConfigured } from './supabase';

const TOKEN_KEY = 'memo.access_token';

interface SessionValue {
  token: string | null;
  /** True when the API is configured, so screens hit real data. */
  live: boolean;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  error: string | null;
}

const SessionContext = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(TOKEN_KEY)
      .then((stored) => setToken(stored))
      .catch(() => setToken(null))
      .finally(() => setReady(true));
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    if (!supabaseConfigured) {
      setError('Supabase is not configured');
      return false;
    }
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    const fresh = data.session?.access_token;
    if (authError || !fresh) {
      setError(authError?.message ?? 'Sign-in failed');
      return false;
    }
    await SecureStore.setItemAsync(TOKEN_KEY, fresh);
    setToken(fresh);
    return true;
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    setToken(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ token, live: API_URL !== '' && token !== null, ready, signIn, signOut, error }),
    [token, ready, signIn, signOut, error],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
