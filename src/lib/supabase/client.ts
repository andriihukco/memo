'use client';

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useMemo } from 'react';
import { useAuth } from './auth-context';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * Creates a Supabase client with the user's JWT attached to every request
 * via the Authorization header, enabling Row Level Security enforcement.
 */
export function createSupabaseClient(accessToken: string): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * React hook that returns a memoized Supabase client bound to the current
 * user's access token. Returns null if no token is available yet.
 */
export function useSupabaseClient(): SupabaseClient | null {
  const { accessToken } = useAuth();

  return useMemo(() => {
    if (!accessToken) return null;
    return createSupabaseClient(accessToken);
  }, [accessToken]);
}
