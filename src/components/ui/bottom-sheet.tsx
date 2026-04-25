'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence, type PanInfo } from 'framer-motion';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function BottomSheet({ open, onClose, children, className, style }: BottomSheetProps) {
  const [sheetHeight, setSheetHeight] = useState(0);
  const [mounted, setMounted] = useState(false);

  // Mount guard — portals need the DOM to be ready
  useEffect(() => { setMounted(true); }, []);

  // Track data-sheets-open on body for tab bar hiding
  useEffect(() => {
    if (open) {
      const prev = parseInt(document.body.getAttribute('data-sheets-open') ?? '0', 10);
      document.body.setAttribute('data-sheets-open', String(prev + 1));
      return () => {
        const cur = parseInt(document.body.getAttribute('data-sheets-open') ?? '1', 10);
        const next = Math.max(0, cur - 1);
        if (next === 0) document.body.removeAttribute('data-sheets-open');
        else document.body.setAttribute('data-sheets-open', String(next));
      };
    }
  }, [open]);

  const handleDragEnd = (_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const threshold = sheetHeight * 0.35;
    const velocityThreshold = 500;
    if (info.offset.y > threshold || info.velocity.y > velocityThreshold) {
      onClose();
    }
  };

  const sheet = (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[60] flex items-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{
              type: 'spring',
              damping: 30,
              stiffness: 300,
              mass: 0.8,
            }}
            drag="y"
            dragConstraints={{ top: 0 }}
            dragElastic={0.2}
            onDragEnd={handleDragEnd}
            onAnimationComplete={() => {
              const el = document.querySelector('[data-bottom-sheet-panel]');
              if (el) setSheetHeight(el.clientHeight);
            }}
            data-bottom-sheet-panel
            className={cn(
              'relative w-full rounded-t-2xl bg-surface-elevated shadow-drawer',
              className,
            )}
            style={{
              paddingBottom: 'calc(max(var(--bottom-inset, 0px), 16px) + 1rem)',
              ...style,
            }}
          >
            {/* Drag handle with 44px touch zone */}
            <div className="flex h-[44px] items-center justify-center cursor-grab active:cursor-grabbing">
              <motion.div
                className="h-1 w-10 rounded-full bg-muted"
                whileHover={{ scaleX: 1.2 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
              />
            </div>

            {children}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );

  // Render into document.body via portal so fixed positioning is never
  // clipped by overflow:auto/scroll ancestors (e.g. the main scroll container)
  if (!mounted) return null;
  return createPortal(sheet, document.body);
}
