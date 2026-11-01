import Link from "next/link";
import { ThemeSwitch } from "@/components/shell/theme-switch";
import { StartAnonymously } from "@/components/features/landing/start-anonymously";
import { DayHero, NightHero } from "@/components/features/landing/hero";
import { DayBand, NightBand } from "@/components/features/landing/widget-bands";
import {
  DataPlain,
  FinalCta,
  HowItWorks,
  PrivacyOnLogs,
  RetroPreview,
} from "@/components/features/landing/story-sections";

const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

export default function Home() {
  const actions = (
    <>
      <Link
        href="/login"
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.97]"
      >
        Start free
      </Link>
      <div className="w-full sm:w-auto">
        <StartAnonymously />
      </div>
      {TELEGRAM_BOT ? (
        <a
          href={`https://t.me/${TELEGRAM_BOT}`}
          className="inline-flex min-h-11 items-center rounded-md border px-5 text-sm font-medium transition-colors hover:bg-muted"
        >
          Open in Telegram
        </a>
      ) : null}
    </>
  );

  return (
    <main className="min-h-screen overflow-x-hidden">
      <header className="fixed inset-x-0 top-0 z-50 bg-background/60 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-lg font-semibold">Memo</span>
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeSwitch />
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-md border px-4 text-sm font-medium transition-colors hover:bg-muted"
            >
              Sign in
            </Link>
          </div>
        </div>
      </header>

      <DayHero actions={actions} />
      <NightHero actions={actions} />
      <DayBand />
      <NightBand />
      <HowItWorks />
      <PrivacyOnLogs />
      <DataPlain />
      <RetroPreview />
      <FinalCta actions={actions} />

      <footer className="mx-auto max-w-6xl px-4 pb-12 pt-4 text-xs text-muted-foreground sm:px-6">
        <p>Your entries are encrypted at rest on the server. They are not end-to-end encrypted yet.</p>
      </footer>
    </main>
  );
}
