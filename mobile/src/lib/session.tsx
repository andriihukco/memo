import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { API_URL } from './api';
import { supabase, supabaseConfigured } from './supabase';
import { t } from '../i18n';

/** Web app origin for Telegram sign-in (the Telegram widget only runs on the web). */
const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? '';

const TOKEN_KEY = 'memo.access_token';
const REFRESH_KEY = 'memo.refresh_token';

/** Who is signed in, for the profile card in Settings. Null when signed out. */
export interface Account {
  email: string | null;
  anonymous: boolean;
}

interface SessionValue {
  token: string | null;
  account: Account | null;
  /** True when the API is configured, so screens hit real data. */
  live: boolean;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<boolean>;
  /** Emails a one-time code to the address. */
  sendEmailCode: (email: string) => Promise<boolean>;
  /** Exchanges the emailed code for a session. */
  verifyEmailCode: (email: string, code: string) => Promise<boolean>;
  /** Google sign-in through the system browser. */
  signInWithGoogle: () => Promise<boolean>;
  /** Telegram login through the web app, returned to the app with a session. */
  signInWithTelegram: () => Promise<boolean>;
  /** Start without an account: an anonymous session. */
  signInAnonymously: () => Promise<boolean>;
  signOut: () => Promise<void>;
  error: string | null;
}

const SessionContext = createContext<SessionValue | null>(null);

async function storeSession(access: string, refresh: string | null): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, access);
  if (refresh) await SecureStore.setItemAsync(REFRESH_KEY, refresh);
}

/**
 * Keeps the signed-in state across launches. The access token lives about an hour,
 * so on start the stored refresh token is exchanged for a fresh pair.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  // Stored with the token it belongs to, so a sign-out or a new session never shows the old account.
  const [accountFor, setAccountFor] = useState<{ token: string; account: Account | null } | null>(null);
  const account = token && accountFor?.token === token ? accountFor.account : null;
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read the account once a session exists, so Settings can show a profile instead of Sign in.
  useEffect(() => {
    if (!token || !supabaseConfigured) return;
    let active = true;
    void supabase.auth.getUser().then(({ data }) => {
      const user = data.user;
      if (active) setAccountFor({ token, account: user ? { email: user.email ?? null, anonymous: !user.email && !!user.is_anonymous } : null });
    });
    return () => {
      active = false;
    };
  }, [token]);

  useEffect(() => {
    void (async () => {
      try {
        const refresh = await SecureStore.getItemAsync(REFRESH_KEY);
        if (refresh && supabaseConfigured) {
          const { data, error: refreshError } = await supabase.auth.refreshSession({ refresh_token: refresh });
          if (!refreshError && data.session) {
            await storeSession(data.session.access_token, data.session.refresh_token);
            setToken(data.session.access_token);
            return;
          }
        }
        setToken(await SecureStore.getItemAsync(TOKEN_KEY));
      } catch {
        setToken(null);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const adopt = useCallback(async (access: string, refresh: string | null): Promise<boolean> => {
    await storeSession(access, refresh);
    setToken(access);
    return true;
  }, []);

  const fail = useCallback((message: string): false => {
    setError(message);
    return false;
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<boolean> => {
    setError(null);
    if (!supabaseConfigured) return fail('Supabase is not configured');
    const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    const session = data.session;
    if (authError || !session) return fail(authError?.message ?? 'Sign-in failed');
    return adopt(session.access_token, session.refresh_token);
  }, [adopt, fail]);

  const sendEmailCode = useCallback(async (email: string): Promise<boolean> => {
    setError(null);
    if (!supabaseConfigured) return fail('Supabase is not configured');
    const { error: otpError } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    return otpError ? fail(otpError.message) : true;
  }, [fail]);

  const verifyEmailCode = useCallback(async (email: string, code: string): Promise<boolean> => {
    setError(null);
    const { data, error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    const session = data.session;
    if (verifyError || !session) return fail(verifyError?.message ?? 'Sign-in failed');
    return adopt(session.access_token, session.refresh_token);
  }, [adopt, fail]);

  const signInWithGoogle = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!supabaseConfigured) return fail('Supabase is not configured');
    const redirectTo = Linking.createURL('auth/callback');
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (oauthError || !data.url) return fail(oauthError?.message ?? 'Sign-in failed');
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return false;
    // Provider turned off or refused: Supabase sends the reason in the query.
    const query = new URLSearchParams(result.url.split('?')[1]?.split('#')[0] ?? '');
    if (query.get('error')) return fail(t('signin.google_off'));
    // Supabase returns the tokens in the URL fragment.
    const params = new URLSearchParams(result.url.split('#')[1] ?? '');
    const access = params.get('access_token');
    if (!access) return fail('Sign-in failed');
    return adopt(access, params.get('refresh_token'));
  }, [adopt, fail]);

  const signInWithTelegram = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!WEB_URL) return fail('Telegram sign-in is not configured');
    const redirectTo = Linking.createURL('auth/callback');
    const loginUrl = `${WEB_URL}/login?native=1&return=${encodeURIComponent(redirectTo)}`;
    const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectTo);
    if (result.type !== 'success') return false;
    const params = new URLSearchParams(result.url.split('#')[1] ?? '');
    const access = params.get('access_token');
    if (!access) return fail('Sign-in failed');
    return adopt(access, params.get('refresh_token'));
  }, [adopt, fail]);

  const signInAnonymously = useCallback(async (): Promise<boolean> => {
    setError(null);
    if (!supabaseConfigured) return fail('Supabase is not configured');
    const { data, error: anonError } = await supabase.auth.signInAnonymously();
    const session = data.session;
    if (anonError || !session) return fail(/disabled/i.test(anonError?.message ?? '') ? t('signin.guest_off') : t('signin.anonymous_failed'));
    return adopt(session.access_token, session.refresh_token);
  }, [adopt, fail]);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY).catch(() => {});
    await SecureStore.deleteItemAsync(REFRESH_KEY).catch(() => {});
    setToken(null);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      token,
      account,
      live: API_URL !== '' && token !== null,
      ready,
      signIn,
      sendEmailCode,
      verifyEmailCode,
      signInWithGoogle,
      signInWithTelegram,
      signInAnonymously,
      signOut,
      error,
    }),
    [token, account, ready, signIn, sendEmailCode, verifyEmailCode, signInWithGoogle, signInWithTelegram, signInAnonymously, signOut, error],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}
