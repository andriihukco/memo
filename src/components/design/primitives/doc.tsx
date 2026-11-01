'use client';

import { useState, type ReactNode } from 'react';
import { Check, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function DocSection({ id, eyebrow, title, description, children }: {
  id: string;
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24 space-y-6 border-t pt-10">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{eyebrow}</p>
        <h2 id={`${id}-title`} className="text-2xl font-semibold tracking-tight">{title}</h2>
        {description && <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">{description}</p>}
      </header>
      {children}
    </section>
  );
}

export function DemoCard({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-3 rounded-xl border bg-card p-4', className)}>
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      {children}
    </div>
  );
}

export function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (insecure context, permissions). The code stays selectable.
    }
  };

  return (
    <div className="relative rounded-lg border bg-muted/40">
      <Button
        variant="ghost"
        size="sm"
        className="absolute end-2 top-2 min-h-11 gap-1.5 md:min-h-8"
        onClick={copy}
        aria-label={copied ? 'Copied' : 'Copy code'}
      >
        {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        {copied ? 'Copied' : 'Copy'}
      </Button>
      <pre className="overflow-x-auto p-4 pe-28 text-sm leading-relaxed"><code className="font-mono">{code}</code></pre>
    </div>
  );
}

export interface PropRow {
  name: string;
  type: string;
  default?: string;
  description: string;
}

export function PropsTable({ rows }: { rows: PropRow[] }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-[32rem] text-start text-sm">
        <thead className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th scope="col" className="px-3 py-2 text-start font-medium">Prop</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">Type</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">Default</th>
            <th scope="col" className="px-3 py-2 text-start font-medium">Description</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.name} className="border-t align-top">
              <td className="px-3 py-2 font-mono text-xs">{row.name}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.type}</td>
              <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{row.default ?? '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{row.description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StateMatrix({ states }: { states: { label: string; node: ReactNode; note?: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {states.map((s) => (
        <div key={s.label} className="flex flex-col gap-3 rounded-xl border bg-card p-4">
          <div className="flex min-h-11 items-center justify-center">{s.node}</div>
          <p className="text-xs font-medium">{s.label}</p>
          {s.note && <p className="text-xs text-muted-foreground">{s.note}</p>}
        </div>
      ))}
    </div>
  );
}
