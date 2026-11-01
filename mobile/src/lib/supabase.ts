import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/**
 * Auth only. The app keeps the access token in SecureStore itself, so the
 * client does not persist or refresh sessions on its own.
 */
export const supabase = createClient(url, anonKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

export const supabaseConfigured = url !== '' && anonKey !== '';
