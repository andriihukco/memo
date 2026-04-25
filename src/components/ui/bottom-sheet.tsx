'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function BottomSheet({ open, onClose, children, className, style }: BottomSheetProps) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<'open' | 'closed'>('closed');
  const panelRef = useRef<HTMLDivElement>(null);

  // Track drag state
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef<number>(0);
  const isDragging = useRef(false);

  // Mount/unmount with animation
  useEffect(() => {
    if (open) {
      setMounted(true);
      // Increment open sheet counter on body so tab bar can hide
      const prev = parseInt(document.body.getAttribute('data-sheets-open') ?? '0', 10);
      document.body.setAttribute('data-sheets-open', String(prev + 1));
      // Allow DOM to paint before triggering open animation
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setState('open');
        });
      });
      // Cleanup: decrement when this effect re-runs (open → false)
      return () => {
        const cur = parseInt(document.body.getAttribute('data-sheets-open') ?? '1', 10);
        const next = Math.max(0, cur - 1);
        if (next === 0) document.body.removeAttribute('data-sheets-open');
        else document.body.setAttribute('data-sheets-open', String(next));
      };
    } else {
      setState('closed');
      const timer = setTimeout(() => setMounted(false), 250);
      return () => clearTimeout(timer);
    }
  }, [open]);

  const handleBackdropClick = () => {
    onClose();
  };

  // Drag-to-dismiss handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
    dragCurrentY.current = 0;
    isDragging.current = true;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging.current || dragStartY.current === null) return;
    const deltaY = e.touches[0].clientY - dragStartY.current;
    if (deltaY < 0) return; // Don't allow dragging up
    dragCurrentY.current = deltaY;
    if (panelRef.current) {
      panelRef.current.style.transform = `translateY(${deltaY}px)`;
      panelRef.current.style.transition = 'none';
    }
  };

  const handleTouchEnd = () => {
    if (!isDragging.current) return;
    isDragging.current = false;

    const panel = panelRef.current;
    if (!panel) return;

    const panelHeight = panel.offsetHeight;
    const threshold = panelHeight * 0.4;

    if (dragCurrentY.current > threshold) {
      // Commit close
      panel.style.transition = 'transform 250ms ease-in';
      panel.style.transform = 'translateY(100%)';
      onClose();
    } else {
      // Spring back
      panel.style.transition = 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)';
      panel.style.transform = 'translateY(0)';
    }

    dragStartY.current = null;
    dragCurrentY.current = 0;
  };

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end">
      {/* Backdrop */}
      <div
        className={cn(
          'absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-200',
          state === 'open' ? 'opacity-100' : 'opacity-0'
        )}
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={panelRef}
        data-state={state}
        className={cn(
          'relative w-full rounded-t-2xl bg-surface-elevated shadow-drawer',
          'transition-transform',
          state === 'open'
            ? '[transition-duration:300ms] [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] translate-y-0'
            : '[transition-duration:250ms] [transition-timing-function:ease-in] translate-y-full',
          className
        )}
        style={{
          paddingBottom: 'calc(max(var(--bottom-inset, 0px), 16px) + 1rem)',
          ...style,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle with 44px touch zone */}
        <div className="flex h-[44px] items-center justify-center">
          <div className="h-1 w-10 rounded-full bg-muted" />
        </div>

        {children}
      </div>
    </div>
  );
}
