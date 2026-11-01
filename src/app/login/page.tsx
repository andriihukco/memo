"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getBrowserAuthClient } from "@/lib/supabase/browser";

const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

/** Native app return address. Only the app's own schemes are allowed, so the page cannot redirect elsewhere. */
const NATIVE_RETURN = /^(memo|exp):\/\/[^\s]*$/;

type TelegramUser = Record<string, string | number | undefined>;

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const supabase = getBrowserAuthClient();

  // Already signed in: go straight to the app.
  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/miniapp");
    });
  }, [supabase, router]);

  // Telegram Login Widget. The widget calls window.onTelegramAuth with a signed payload.
  useEffect(() => {
    if (!TELEGRAM_BOT || !widgetRef.current) return;
    window.onTelegramAuth = async (user) => {
      setError(null);
      const res = await fetch("/api/auth/telegram/web", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(user),
      });
      const data = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; error?: string };
      if (!res.ok || !data.access_token || !data.refresh_token || !supabase) {
        setError(data.error ?? "Telegram sign-in failed. Try again.");
        return;
      }
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionErr) {
        setError("Could not start your session. Try again.");
        return;
      }
      // Native app: hand the tokens back through its deep link (the app stores them in SecureStore).
      const params = new URLSearchParams(window.location.search);
      const nativeReturn = params.get("native") === "1" ? params.get("return") : null;
      if (nativeReturn && NATIVE_RETURN.test(nativeReturn)) {
        window.location.href = `${nativeReturn}#access_token=${encodeURIComponent(data.access_token)}&refresh_token=${encodeURIComponent(data.refresh_token)}`;
        return;
      }
      router.replace("/miniapp");
    };

    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", TELEGRAM_BOT);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    widgetRef.current.appendChild(script);
    const node = widgetRef.current;
    return () => {
      delete window.onTelegramAuth;
      node.innerHTML = "";
    };
  }, [supabase, router]);

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) return setError("Sign-in is not configured.");
    setError(null);
    setStatus("sending");
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    if (otpErr) {
      setStatus("idle");
      setError(otpErr.message);
      return;
    }
    setStatus("sent");
  }

  async function signInWithGoogle() {
    if (!supabase) return setError("Sign-in is not configured.");
    setError(null);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthErr) setError(oauthErr.message);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col gap-6 px-6 py-12">
      <h1 className="text-2xl font-bold">Sign in to Memo</h1>

      {!supabase ? (
        <p role="alert" className="text-sm text-destructive">Sign-in is not configured on this server.</p>
      ) : null}

      {status === "sent" ? (
        <div role="status" className="rounded-md border p-4 text-sm">
          Check <strong>{email}</strong> for a sign-in link. You can close this tab after you open it.
        </div>
      ) : (
        <form onSubmit={sendLink} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm font-medium">Email</label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 rounded-md border bg-background px-3 text-base"
            placeholder="you@example.com"
          />
          <Button type="submit" disabled={status === "sending" || !email.trim()} className="h-11">
            {status === "sending" ? "Sending…" : "Email me a sign-in link"}
          </Button>
        </form>
      )}

      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>

      <Button variant="outline" onClick={signInWithGoogle} className="h-11" disabled={!supabase}>
        Continue with Google
      </Button>

      <div className="flex flex-col items-center gap-2">
        {TELEGRAM_BOT ? (
          <div ref={widgetRef} />
        ) : (
          <p className="text-sm text-muted-foreground">Telegram sign-in is not configured.</p>
        )}
      </div>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
    </main>
  );
}
