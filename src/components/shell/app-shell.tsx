'use client';

import { useEffect, type ReactNode } from 'react';
import { Toaster } from '@/components/ui/sonner';
import { ComposeProvider } from '@/components/features/compose/compose-drawer';
import { useSound } from '@/lib/sound/use-sound';
import { withVerticalSwipesDisabled } from '@/lib/telegram';
import { OfflineBanner } from './offline-banner';
import { TabBar } from './tab-bar';

/**
 * Keeps Telegram's swipe-to-close off while any vaul drawer is open. Watching the DOM covers every
 * Drawer (new and legacy) without wrapping each onOpenChange: vaul marks its content `[vaul-drawer]`
 * with data-state="open" | "closed" and portals it into body.
 */
function DrawerOpenTracker() {
  useEffect(() => {
    let last = false;
    const sync = () => {
      const open = !!document.querySelector('[vaul-drawer][data-state="open"]');
      if (open !== last) withVerticalSwipesDisabled((last = open));
    };
    const mo = new MutationObserver(sync);
    mo.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['data-state'] });
    return () => {
      mo.disconnect();
      if (last) withVerticalSwipesDisabled(false);
    };
  }, []);
  return null;
}

export function AppShell({ children }: { children: ReactNode }) {
  const { play } = useSound();
  return (
    <ComposeProvider>
      <OfflineBanner />
      <main
        className="relative min-h-0 flex-1 overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))]"
        onClick={(e) => {
          // Legacy behaviour: TAP sound on empty-area clicks only
          const target = e.target as HTMLElement;
          if (!target.closest('button, a, input, textarea, select, [role="button"], [role="switch"]')) play('TAP');
        }}
      >
        {children}
      </main>
      <TabBar />
      <Toaster position="top-center" />
      <DrawerOpenTracker />
    </ComposeProvider>
  );
}
