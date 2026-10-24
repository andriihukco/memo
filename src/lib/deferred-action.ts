// Module-level so a pending commit survives component unmounts; safe to import during SSR.
type Pending = { timer: ReturnType<typeof setTimeout>; commit: () => Promise<void>; rollback: () => void };

const pending = new Map<string, Pending>();
let listening = false;

function listen() {
  if (listening || typeof window === 'undefined') return;
  listening = true;
  window.addEventListener('pagehide', () => void flushAll());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flushAll();
  });
}

async function run(key: string) {
  const p = pending.get(key);
  if (!p) return;
  clearTimeout(p.timer);
  pending.delete(key);
  await p.commit();
}

export function schedule(key: string, commit: () => Promise<void>, rollback: () => void, ms = 5000): void {
  listen();
  const prev = pending.get(key);
  if (prev) clearTimeout(prev.timer);
  pending.set(key, { timer: setTimeout(() => void run(key), ms), commit, rollback });
}

export function undo(key: string): boolean {
  const p = pending.get(key);
  if (!p) return false;
  clearTimeout(p.timer);
  pending.delete(key);
  p.rollback();
  return true;
}

export async function flushAll(): Promise<void> {
  await Promise.allSettled([...pending.keys()].map(run));
}

export const pendingKeys = (): string[] => [...pending.keys()];
