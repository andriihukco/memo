import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

/** Base pulse skeleton */
export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-muted/60', className)} />
  );
}

/** Shimmer variant using the .skeleton-shimmer CSS class */
export function SkeletonShimmer({ className }: SkeletonProps) {
  return (
    <div className={cn('skeleton-shimmer rounded-xl', className)} />
  );
}

/** 80px tall placeholder for report cards */
export function SkeletonReportCard({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-20 w-full rounded-xl', className)} />;
}

/** 96px tall placeholder for metric cards */
export function SkeletonMetricCard({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-24 w-full rounded-xl', className)} />;
}

/** 72px tall placeholder for entry cards */
export function SkeletonEntryCard({ className }: SkeletonProps) {
  return <Skeleton className={cn('h-[72px] w-full rounded-xl', className)} />;
}
