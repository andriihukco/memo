'use client';

import { useCallback } from 'react';
import { toast } from 'sonner';
import { useI18n } from '@/lib/i18n/context';
import { schedule, undo } from '@/lib/deferred-action';

interface Opts {
  key: string;
  label: string;
  remove: () => void;
  restore: () => void;
  commit: () => Promise<void>;
}

export function useUndoableDelete() {
  const { t } = useI18n();
  return useCallback(
    ({ key, label, remove, restore, commit }: Opts) => {
      remove();
      // duration matches the 5000ms commit; Sonner's 4000 default would hide Undo early
      const id = toast(label, { duration: 5000, action: { label: t('shell.undo'), onClick: () => undo(key) } });
      schedule(
        key,
        async () => {
          toast.dismiss(id); // after a visibility flush Undo would be a dead button
          try {
            await commit();
          } catch {
            restore();
            toast.error(t('shell.delete_failed'));
          }
        },
        restore,
      );
    },
    [t],
  );
}
