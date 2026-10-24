'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Drawer, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/lib/i18n/context';

interface ComposeCtx {
  open(): void;
  close(): void;
  isOpen: boolean;
  hasDraft: boolean;
}

const Ctx = createContext<ComposeCtx | null>(null);

export function useCompose(): ComposeCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useCompose must be used inside ComposeProvider');
  return c;
}

function readDraft(): boolean {
  try {
    return !!localStorage.getItem('memo:draft');
  } catch {
    return false;
  }
}

export function ComposeProvider({ children }: { children: ReactNode }) {
  const [isOpen, setOpen] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const open = useCallback(() => setOpen(true), []);
  const close = useCallback(() => setOpen(false), []);

  useEffect(() => setHasDraft(readDraft()), [isOpen]);

  const value = useMemo(() => ({ open, close, isOpen, hasDraft }), [open, close, isOpen, hasDraft]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <ComposeDrawer />
    </Ctx.Provider>
  );
}

/** Stub: Phase 1 Task B replaces the body with the real composer. */
export function ComposeDrawer() {
  const { t } = useI18n();
  const { isOpen, close } = useCompose();
  return (
    <Drawer open={isOpen} onOpenChange={(o) => !o && close()}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>{t('shell.compose')}</DrawerTitle>
        </DrawerHeader>
        <div className="px-4">
          <Textarea aria-label={t('shell.compose')} placeholder={t('shell.compose_placeholder')} rows={5} />
        </div>
        <DrawerFooter>
          <Button disabled>{t('shell.send')}</Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
