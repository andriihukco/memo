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
      schedule(
        key,
        async () => {
          try {
            await commit();
          } catch {
            restore();
            toast.error(t('shell.delete_failed'));
          }
        },
        restore,
      );
      toast(label, { action: { label: t('shell.undo'), onClick: () => undo(key) } });
    },
    [t],
  );
}
