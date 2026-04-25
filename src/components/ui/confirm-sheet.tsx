'use client';

import { useEffect } from 'react';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { useSound } from '@/lib/sound/use-sound';

interface ConfirmSheetProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  subtitle?: string;
  confirmLabel: string;
  cancelLabel?: string;
}

export function ConfirmSheet({
  open,
  onClose,
  onConfirm,
  title,
  subtitle,
  confirmLabel,
  cancelLabel = 'Скасувати',
}: ConfirmSheetProps) {
  const { play } = useSound();

  // Play CAUTION sound when sheet opens
  useEffect(() => {
    if (open) {
      play('CAUTION');
    }
  }, [open, play]);

  const handleConfirm = () => {
    play('CAUTION');
    onConfirm();
  };

  const handleCancel = () => {
    play('CLOSE');
    onClose();
  };

  return (
    <BottomSheet open={open} onClose={handleCancel}>
      <div className="flex flex-col gap-4 px-4 pt-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-[17px] font-semibold">{title}</h2>
          {subtitle && (
            <p className="text-[13px] text-muted-foreground">{subtitle}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            variant="destructive"
            className="w-full min-h-[44px]"
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
          <Button
            variant="ghost"
            className="w-full min-h-[44px]"
            onClick={handleCancel}
          >
            {cancelLabel}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
