'use client';

import { Skeleton } from '@/components/ui/skeleton';

interface Props {
  period: { from: string; to: string };
  locked: boolean;
  onUpgrade(): void;
}

/** Stub: Phase 1 Task D implements the graph. */
export function GraphView(_props: Props) {
  return <Skeleton className="mx-4 h-80 rounded-lg" />;
}
