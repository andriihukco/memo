import Link from "next/link";

const TELEGRAM_BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME;

const FEATURES = [
  { title: "Log what you did", body: "Write a line or add a number: steps, minutes, hours of sleep." },
  { title: "Track goals", body: "Set a daily or weekly target. See progress and your streak." },
  { title: "Weekly retro", body: "A short review of the week: what went well, what did not, and one thing to try." },
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-12 px-6 py-12">
      <header className="flex items-center justify-between">
        <span className="text-lg font-semibold">Memo</span>
        <Link href="/login" className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted">
          Sign in
        </Link>
      </header>

      <section className="flex flex-col gap-5">
        <h1 className="text-4xl font-bold leading-tight tracking-tight">A private log for your goals and weekly retros</h1>
        <p className="text-lg text-muted-foreground">
          Log your steps, sleep and mood in a few taps. Memo shows how your week went, without any AI.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/login" className="rounded-md bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground">
            Start free
          </Link>
          {TELEGRAM_BOT ? (
            <a
              href={`https://t.me/${TELEGRAM_BOT}`}
              className="rounded-md border px-5 py-3 text-sm font-medium hover:bg-muted"
            >
              Open in Telegram
            </a>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-lg border p-4">
            <h2 className="mb-2 font-semibold">{f.title}</h2>
            <p className="text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="text-xs text-muted-foreground">
        Your entries are encrypted at rest on the server. They are not end-to-end encrypted yet.
      </footer>
    </main>
  );
}
