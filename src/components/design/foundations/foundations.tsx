'use client';

import { useState } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { DemoCard } from '../primitives/doc';
const SURFACE_TOKENS = ['background', 'foreground', 'card', 'popover', 'secondary', 'muted', 'accent', 'border', 'input', 'ring'] as const;
const INTENT_TOKENS = ['primary', 'destructive', 'success', 'warning'] as const;
const CATEGORY_TOKENS = Array.from({ length: 12 }, (_, i) => `cat-${i + 1}`);

function Swatch({ token }: { token: string }) {
  return (
    <div className="space-y-1.5">
      <div className="h-12 rounded-md border" style={{ background: `hsl(var(--${token}))` }} aria-hidden />
      <p className="font-mono text-xs text-muted-foreground">--{token}</p>
    </div>
  );
}

const TYPE_SCALE = [
  { name: 'Title', cls: 'text-2xl font-semibold tracking-tight', sample: 'Journal', spec: '24 / semibold / tight' },
  { name: 'Headline', cls: 'text-lg font-semibold', sample: 'Today', spec: '18 / semibold' },
  { name: 'Body', cls: 'text-base', sample: 'Write what happened today.', spec: '16 / regular (16px also stops iOS zoom)' },
  { name: 'Caption', cls: 'text-xs text-muted-foreground', sample: 'Saved 2 min ago', spec: '12 / regular, muted' },
];

const SPACING = [4, 8, 12, 16, 24, 32, 48];

type TokenSet = 'light' | 'dark';

/** Light / dark token switch: .dark redefines the same token names, so the swatches below re-render in that set. */
export function Foundations() {
  const [tokenSet, setTokenSet] = useState<TokenSet>('light');
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm font-medium">Token set</p>
        <ToggleGroup
          type="single"
          value={tokenSet}
          onValueChange={(value) => value && setTokenSet(value as TokenSet)}
          aria-label="Token set"
        >
          <ToggleGroupItem value="light" className="min-h-11 px-4" aria-label="Sepia tokens">Sepia</ToggleGroupItem>
          <ToggleGroupItem value="dark" className="min-h-11 px-4" aria-label="Dark tokens">Dark</ToggleGroupItem>
        </ToggleGroup>
      </div>
      <div data-token-set={tokenSet} className={cn('space-y-6 rounded-xl bg-background p-4 text-foreground', tokenSet === 'dark' && 'dark')}>
      <DemoCard title="Surfaces">
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">{SURFACE_TOKENS.map((t) => <Swatch key={t} token={t} />)}</div>
      </DemoCard>
      <DemoCard title="Intent">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{INTENT_TOKENS.map((t) => <Swatch key={t} token={t} />)}</div>
      </DemoCard>
      <DemoCard title="Categories (12 hues, used by CategoryBadge)">
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">{CATEGORY_TOKENS.map((t) => <Swatch key={t} token={t} />)}</div>
      </DemoCard>
      <DemoCard title="Type scale (Geist, loaded in src/app/layout.tsx)">
        <div className="divide-y">
          {TYPE_SCALE.map((row) => (
            <div key={row.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:justify-between">
              <p className={row.cls}>{row.sample}</p>
              <p className="font-mono text-xs text-muted-foreground">{row.name}: {row.spec}</p>
            </div>
          ))}
        </div>
      </DemoCard>
      <DemoCard title="Spacing (4px base) and radius">
        <div className="flex flex-wrap items-end gap-4">
          {SPACING.map((s) => (
            <div key={s} className="flex flex-col items-center gap-1">
              <div className="rounded-sm bg-primary/70" style={{ width: s, height: s }} aria-hidden />
              <span className="font-mono text-xs text-muted-foreground">{s}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-1">
            <div className="size-12 border bg-muted" style={{ borderRadius: 'var(--radius)' }} aria-hidden />
            <span className="font-mono text-xs text-muted-foreground">--radius</span>
          </div>
        </div>
      </DemoCard>
      </div>
    </div>
  );
}
