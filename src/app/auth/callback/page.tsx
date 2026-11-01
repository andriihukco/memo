"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserAuthClient } from "@/lib/supabase/browser";

/**
 * Landing point for the email link and Google. supabase-js exchanges the `code` in the URL
 * for a session when the client starts (detectSessionInUrl), so this page only waits for it.
 */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const providerError = params.get("error_description") ?? params.get("error");
    if (providerError) {
      setFailed(providerError);
      return;
    }
    const supabase = getBrowserAuthClient();
    if (!supabase) {
      setFailed("Sign-in is not configured on this server.");
      return;
    }
    void supabase.auth.getSession().then(({ data, error }) => {
      if (error || !data.session) {
        setFailed("This sign-in link has expired or was already used. Request a new one.");
        return;
      }
      router.replace("/miniapp");
    });
  }, [router]);

  if (!failed) {
    return <main className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Signing you in…</main>;
  }
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-4 px-6 py-12">
      <p role="alert" className="text-sm">{failed}</p>
      <Link href="/login" className="text-sm font-medium underline">Back to sign in</Link>
    </main>
  );
}
