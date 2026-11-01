'use client';

import { useState, type ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { CodeBlock } from './doc';

export type PropValues = Record<string, string | boolean>;

export type PropControl =
  | { key: string; label: string; kind: 'select'; options: readonly string[]; initial: string }
  | { key: string; label: string; kind: 'toggle'; initial: boolean };

/**
 * Interactive props: controls on the side, live component in the preview, and the
 * JSX snippet that matches the current values.
 */
export function PropsPlayground({ controls, render, snippet }: {
  controls: PropControl[];
  render: (values: PropValues) => ReactNode;
  snippet: (values: PropValues) => string;
}) {
  const [values, setValues] = useState<PropValues>(() =>
    Object.fromEntries(controls.map((c) => [c.key, c.initial])),
  );

  const set = (key: string, value: string | boolean) => setValues((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-[1fr_16rem]">
        <div className="flex min-h-32 items-center justify-center rounded-xl border bg-card p-6">{render(values)}</div>
        <fieldset className="space-y-4 rounded-xl border bg-card p-4">
          <legend className="px-1 text-sm font-medium">Props</legend>
          {controls.map((c) =>
            c.kind === 'select' ? (
              <label key={c.key} className="flex flex-col gap-1.5 text-sm">
                <span className="text-muted-foreground">{c.label}</span>
                <select
                  value={String(values[c.key])}
                  onChange={(e) => set(c.key, e.target.value)}
                  className="min-h-11 rounded-md border border-input bg-background px-3 text-base md:text-sm"
                >
                  {c.options.map((o) => (
                    <option key={o} value={o}>{o}</option>
                  ))}
                </select>
              </label>
            ) : (
              <div key={c.key} className="flex min-h-11 items-center justify-between gap-3 text-sm">
                <span className="text-muted-foreground">{c.label}</span>
                <Switch checked={Boolean(values[c.key])} onCheckedChange={(v) => set(c.key, v)} aria-label={c.label} />
              </div>
            ),
          )}
        </fieldset>
      </div>
      <CodeBlock code={snippet(values)} />
    </div>
  );
}
