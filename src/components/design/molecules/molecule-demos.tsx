'use client';

import { useState } from 'react';
import { BookOpen, Inbox, Sparkles } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { CategoryBadge } from '@/components/patterns/category-badge';
import { EmptyState } from '@/components/patterns/empty-state';
import { ErrorState } from '@/components/patterns/error-state';
import { ListGroup, ListRow } from '@/components/patterns/list-group';
import { MetricPill } from '@/components/patterns/metric-pill';
import { PlatformFrame, usePlatform, TOUCH_TARGET } from '../primitives/platform';
import { DemoCard, StateMatrix } from '../primitives/doc';

export function ListRowDemo() {
  const { platform } = usePlatform();
  const [reminders, setReminders] = useState(true);
  return (
    <PlatformFrame>
      <ListGroup title="Settings" footer="Changes apply to new entries only.">
        <ListRow icon={BookOpen} label="Journal" description="Entries from the last 30 days" value="128" href="/miniapp" />
        <ListRow
          icon={Sparkles}
          label="Reminders"
          trailing={<Switch checked={reminders} onCheckedChange={setReminders} aria-label="Reminders" />}
        />
        <ListRow icon={Inbox} label="Delete account" destructive onClick={() => undefined} />
      </ListGroup>
      <p className={`mt-3 text-xs text-muted-foreground ${TOUCH_TARGET[platform]} flex items-center`}>
        Rows are at least {platform === 'android' ? '48dp' : '44pt'} tall. Interactive trailing controls require a non-interactive row.
      </p>
    </PlatformFrame>
  );
}

export function ErrorStateDemo() {
  const [retries, setRetries] = useState(0);
  return (
    <div className="space-y-3">
      <ErrorState
        title="Couldn't load entries"
        description="Check your connection and try again."
        onRetry={() => setRetries((n) => n + 1)}
        retryLabel="Try again"
      />
      <p className="text-xs text-muted-foreground" aria-live="polite">Retry pressed {retries} time(s).</p>
    </div>
  );
}

export function EmptyStateDemo() {
  return (
    <EmptyState
      icon={Inbox}
      title="No entries yet"
      description="Write your first thought. It stays private and encrypted."
      action={{ label: 'Write an entry', onClick: () => undefined }}
    />
  );
}

export function MetricAndBadgeDemo() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <MetricPill label="Entries" value="128" />
      <MetricPill label="Streak" value="6 days" />
      <CategoryBadge name="Food" label="Food" />
      <CategoryBadge name="Health" label="Health" />
    </div>
  );
}

export function CardDemo() {
  return (
    <Card className="max-w-sm">
      <CardHeader>
        <CardTitle>Weekly insight</CardTitle>
        <CardDescription>Based on your entries from Monday to Sunday.</CardDescription>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        You wrote most about sleep on weekdays.
      </CardContent>
    </Card>
  );
}

export function MoleculeStates() {
  return (
    <StateMatrix
      states={[
        { label: 'Error with retry', node: <div className="w-full"><ErrorState title="Failed" description="Retry." onRetry={() => undefined} retryLabel="Retry" /></div> },
        { label: 'Empty', node: <div className="w-full"><EmptyStateDemo /></div> },
        { label: 'Loading (skeleton)', node: <div className="h-12 w-full animate-pulse rounded-md bg-muted" aria-label="Loading" /> },
        { label: 'Metric pill', node: <MetricPill label="Entries" value="—" /> },
      ]}
    />
  );
}

export function MoleculeCardSet() {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <DemoCard title="Card">
        <CardDemo />
      </DemoCard>
      <DemoCard title="Metric and badges">
        <MetricAndBadgeDemo />
      </DemoCard>
    </div>
  );
}
