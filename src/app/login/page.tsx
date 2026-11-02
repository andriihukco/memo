"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBrowserAuthClient } from "@/lib/supabase/browser";
import { DICTS, fill, type SiteLocale } from "@/lib/marketing/dict";
import { LogoMark } from "@/components/marketing/logo-mark";
import { StartAnonymously } from "@/components/features/landing/start-anonymously";
import { cn } from "@/lib/utils";

const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

/** Native app return address. Only the app's own schemes are allowed, so the page cannot redirect elsewhere. */
const NATIVE_RETURN = /^(memo|exp):\/\/[^\s]*$/;

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

type TelegramUser = Record<string, string | number | undefined>;
type Step = "email" | "existing" | "new" | "sent";

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramUser) => void;
  }
}

/** The site language from the cookie the header switch sets. English until it is set. */
function readLocale(): SiteLocale {
  if (typeof document === "undefined") return "en";
  const saved = document.cookie.split("; ").find((c) => c.startsWith("memo-site-lang="))?.split("=")[1];
  return saved === "uk" ? "uk" : "en";
}

export default function LoginPage() {
  const router = useRouter();
  const [locale, setLocale] = useState<SiteLocale>("en");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);
  const supabase = getBrowserAuthClient();
  const a = DICTS[locale].auth;

  useEffect(() => {
    setLocale(readLocale());
  }, []);

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
        setError(data.error ?? DICTS[readLocale()].auth.failed);
        return;
      }
      const { error: sessionErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });
      if (sessionErr) {
        setError(DICTS[readLocale()].auth.failed);
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
    const node = widgetRef.current;
    node.appendChild(script);
    return () => {
      delete window.onTelegramAuth;
      node.innerHTML = "";
    };
  }, [supabase, router]);

  const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  /**
   * Step one: the email. A magic link is requested without creating an account. If Supabase refuses
   * because the address has no account, the flow switches to sign-up. Otherwise the address is an
   * existing account, so the user can take the link or use a password.
   */
  async function continueWithEmail(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setError(a.notConfigured);
    setError(null);
    setBusy(true);
    const address = email.trim();
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: address,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    });
    setBusy(false);
    if (!otpErr) return setStep("existing");
    // No account for this address: the sign-up path, which creates it when the link is opened.
    if (/signup|not allowed|user not found/i.test(otpErr.message) || otpErr.status === 400 || otpErr.status === 422) {
      return setStep("new");
    }
    setError(otpErr.message);
  }

  async function sendNewAccountLink() {
    if (!supabase) return setError(a.notConfigured);
    setBusy(true);
    setError(null);
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
    });
    setBusy(false);
    if (otpErr) return setError(otpErr.message);
    setStep("sent");
  }

  async function signInWithPassword(e: FormEvent) {
    e.preventDefault();
    if (!supabase) return setError(a.notConfigured);
    setBusy(true);
    setError(null);
    const { error: pwErr } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (pwErr) return setError(a.wrongPassword);
    router.replace("/miniapp");
  }

  async function signInWithGoogle() {
    if (!supabase) return setError(a.notConfigured);
    setError(null);
    const { error: oauthErr } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });
    if (oauthErr) setError(oauthErr.message);
  }

  const back = () => {
    setStep("email");
    setPassword("");
    setShowPassword(false);
    setError(null);
  };

  const heading =
    step === "existing" ? a.welcomeBack : step === "new" ? a.newHere : step === "sent" ? a.sent : a.signInTitle;

  return (
    <div className="flex min-h-svh flex-col bg-day-bottom dark:bg-night-top">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-5">
        <Link href="/" aria-label={a.home} className={cn("flex min-h-11 items-center gap-2 rounded-full pr-2", FOCUS)}>
          <LogoMark className="size-9" />
          <span className="title-2">Memo</span>
        </Link>
        {step === "email" ? (
          <Link href="/" className={cn("body-5 inline-flex min-h-11 items-center rounded-full px-3 text-foreground/70 transition-colors hover:text-foreground", FOCUS)}>
            ‹ {a.back}
          </Link>
        ) : (
          <button type="button" onClick={back} className={cn("body-5 inline-flex min-h-11 items-center rounded-full px-3 text-foreground/70 transition-colors hover:text-foreground", FOCUS)}>
            ‹ {a.back}
          </button>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-6 pb-16 pt-6">
        <div className="flex w-full max-w-sm flex-col items-center text-center motion-safe:animate-mk-fade-in">
          <h1 className="heading-2">{heading}</h1>
          {step === "email" ? <p className="body-3 mt-4 text-foreground/70">{a.signInSub}</p> : null}

          {!supabase ? (
            <p role="alert" className="caption-4 mt-6 text-destructive">{a.notConfigured}</p>
          ) : null}

          {step === "sent" ? (
            <div role="status" className="mt-10 w-full rounded-3xl bg-background/70 p-6 shadow-sm backdrop-blur-xl">
              <p className="body-3 text-foreground/80">{fill(a.sentBody, { email })}</p>
            </div>
          ) : null}

          {step === "email" || step === "new" ? (
            <form onSubmit={step === "email" ? continueWithEmail : (e) => { e.preventDefault(); void sendNewAccountLink(); }} className="mt-10 flex w-full flex-col gap-3">
              <label htmlFor="email" className="sr-only">{a.email}</label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={step === "new"}
                placeholder={a.emailHint}
                className={cn("min-h-14 rounded-2xl border border-foreground/15 bg-background/80 px-5 text-center text-lg backdrop-blur-xl", FOCUS)}
              />
              {step === "new" ? <p className="caption-4 text-foreground/70">{a.newHere}</p> : null}
              <button
                type="submit"
                disabled={busy || !email.trim() || !supabase}
                className={cn("btn-shimmer min-h-14 rounded-full bg-primary px-6 text-lg font-semibold text-primary-foreground transition-transform duration-300 ease-base active:scale-[0.98] disabled:opacity-40", FOCUS)}
              >
                {busy ? a.sending : step === "new" ? a.createAccount : a.cont}
              </button>
            </form>
          ) : null}

          {step === "existing" ? (
            <div className="mt-10 flex w-full flex-col gap-3">
              <p className="body-6 text-foreground/70">{email}</p>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const { error: otpErr } = await supabase!.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: redirectTo, shouldCreateUser: false } });
                  setBusy(false);
                  if (otpErr) setError(otpErr.message);
                  else setStep("sent");
                }}
                className={cn("btn-shimmer min-h-14 rounded-full bg-primary px-6 text-lg font-semibold text-primary-foreground transition-transform duration-300 ease-base active:scale-[0.98] disabled:opacity-40", FOCUS)}
              >
                {a.magicLink}
              </button>
              {!showPassword ? (
                <button type="button" onClick={() => setShowPassword(true)} className={cn("min-h-14 rounded-full border border-foreground/20 px-6 text-lg font-medium transition-colors hover:bg-foreground/5", FOCUS)}>
                  {a.usePassword}
                </button>
              ) : (
                <form onSubmit={signInWithPassword} className="flex flex-col gap-3">
                  <label htmlFor="password" className="sr-only">{a.password}</label>
                  <input
                    id="password"
                    type="password"
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={a.password}
                    className={cn("min-h-14 rounded-2xl border border-foreground/15 bg-background/80 px-5 text-center text-lg backdrop-blur-xl", FOCUS)}
                  />
                  <button type="submit" disabled={busy || !password} className={cn("min-h-14 rounded-full bg-primary px-6 text-lg font-semibold text-primary-foreground disabled:opacity-40", FOCUS)}>
                    {a.signInPassword}
                  </button>
                </form>
              )}
            </div>
          ) : null}

          <div className="my-8 flex w-full items-center gap-4 text-sm text-foreground/50">
            <span className="h-px flex-1 bg-foreground/15" />
            {a.or}
            <span className="h-px flex-1 bg-foreground/15" />
          </div>

          <div className="flex w-full flex-col gap-3">
            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={!supabase}
              className={cn("min-h-14 rounded-full border border-foreground/20 bg-background/60 px-6 text-lg font-medium backdrop-blur-xl transition-colors hover:bg-background disabled:opacity-40", FOCUS)}
            >
              {a.google}
            </button>
            <div className="flex flex-col items-center gap-2">
              {TELEGRAM_BOT ? <div ref={widgetRef} className="min-h-11" /> : <p className="caption-5 text-foreground/60">{a.telegramOff}</p>}
            </div>
            <StartAnonymously labels={{ label: a.guest, busy: "…", error: a.failed, off: a.notConfigured }} />
          </div>

          {error ? <p role="alert" className="caption-4 mt-6 text-destructive">{error}</p> : null}

          <p className="caption-5 mt-10 text-foreground/60">
            {a.legal}{" "}
            <Link href="/terms" className="underline underline-offset-4 hover:text-foreground">{a.terms}</Link>
            {` ${a.and} `}
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">{a.privacy}</Link>.
          </p>
        </div>
      </main>
    </div>
  );
}
