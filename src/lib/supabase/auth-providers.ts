/**
 * Which sign-in methods the Supabase project has turned on, read from its public
 * `/auth/v1/settings` endpoint. Lets the sign-in page disable an option with a clear reason
 * instead of sending people to Supabase's raw "provider is not enabled" error page.
 * Mirrored in mobile/src/lib/auth-providers.ts; keep the two in sync.
 */
export interface AuthProviders {
  google: boolean;
  anonymous: boolean;
  email: boolean;
}

export async function fetchAuthProviders(url: string, anonKey: string): Promise<AuthProviders | null> {
  if (!url || !anonKey) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/auth/v1/settings`, { headers: { apikey: anonKey } });
    if (!res.ok) return null;
    const body = (await res.json()) as { external?: Record<string, unknown> };
    const ext = body.external ?? {};
    return { google: ext.google === true, anonymous: ext.anonymous_users === true, email: ext.email === true };
  } catch {
    // Network trouble: unknown, so leave every option on and let the provider answer.
    return null;
  }
}
