'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export type Platform = 'web' | 'android' | 'ios';

const PLATFORMS: Platform[] = ['web', 'android', 'ios'];

const LABEL: Record<Platform, string> = { web: 'Web', android: 'Android', ios: 'iOS' };

/** Minimum touch target per platform: iOS HIG 44pt, Material 48dp, web WCAG 2.5.5 44px. */
export const TOUCH_TARGET: Record<Platform, string> = {
  web: 'min-h-11',
  ios: 'min-h-11 min-w-11',
  android: 'min-h-12',
};

interface PlatformContextValue {
  platform: Platform;
  setPlatform: (platform: Platform) => void;
}

const PlatformContext = createContext<PlatformContextValue>({ platform: 'web', setPlatform: () => undefined });

export function PlatformProvider({ children }: { children: ReactNode }) {
  const [platform, setPlatform] = useState<Platform>('web');
  return <PlatformContext.Provider value={{ platform, setPlatform }}>{children}</PlatformContext.Provider>;
}

export function usePlatform() {
  return useContext(PlatformContext);
}

export function PlatformSwitch() {
  const { platform, setPlatform } = usePlatform();
  return (
    <ToggleGroup
      type="single"
      value={platform}
      onValueChange={(value) => value && setPlatform(value as Platform)}
      aria-label="Preview platform"
    >
      {PLATFORMS.map((p) => (
        <ToggleGroupItem key={p} value={p} className="min-h-11 px-4" aria-label={`Preview as ${LABEL[p]}`}>
          {LABEL[p]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function FrameChrome({ platform }: { platform: Platform }) {
  if (platform === 'ios') {
    return (
      <div className="flex items-center justify-between px-6 pb-1 pt-2 text-xs font-semibold" aria-hidden>
        <span>9:41</span>
        <span className="h-6 w-20 rounded-full bg-foreground" />
        <span className="text-xs">100%</span>
      </div>
    );
  }
  if (platform === 'android') {
    return (
      <div className="flex h-14 items-center bg-primary px-4 text-base font-medium text-primary-foreground" aria-hidden>
        Memo
      </div>
    );
  }
  return (
    <div className="flex items-center gap-1.5 border-b bg-muted/40 px-3 py-2" aria-hidden>
      <span className="size-2.5 rounded-full bg-destructive/70" />
      <span className="size-2.5 rounded-full bg-warning/70" />
      <span className="size-2.5 rounded-full bg-success/70" />
      <span className="ms-3 truncate rounded bg-background px-2 py-0.5 text-xs text-muted-foreground">memo.app/design</span>
    </div>
  );
}

const DEVICE_RADIUS: Record<Platform, number | undefined> = { web: undefined, android: 28, ios: 44 };

/** Wraps a demo in a simulated device or browser frame for the active platform. */
export function PlatformFrame({ children, className }: { children: ReactNode; className?: string }) {
  const { platform } = usePlatform();
  return (
    <div data-platform={platform} className={cn('mx-auto w-full', platform === 'ios' && 'max-w-[375px]', platform === 'android' && 'max-w-[412px]', platform === 'web' && 'max-w-2xl', className)}>
      <div
        className={cn(
          'overflow-hidden bg-background',
          platform === 'web' && 'rounded-xl border shadow-sm',
          platform === 'android' && 'border-2 border-border shadow-md',
          platform === 'ios' && 'border-[6px] border-foreground/90 shadow-lg',
        )}
        // Device-mockup corner radii, not UI radii, so they stay inline.
        style={{ borderRadius: DEVICE_RADIUS[platform] }}
      >
        <FrameChrome platform={platform} />
        <div className="p-4">{children}</div>
        {platform === 'ios' && <div className="mx-auto mb-2 h-1 w-28 rounded-full bg-foreground/40" aria-hidden />}
      </div>
      <p className="mt-2 text-center text-xs text-muted-foreground">Simulated {LABEL[platform]} frame. Native rendering lives in mobile/.</p>
    </div>
  );
}
