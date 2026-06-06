import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { ReactNode } from 'react';

type Props = {
  open: boolean;
  monthLabel: string;
  previousMonthLabel?: string;
  nextMonthLabel?: string;
  onPreviousMonth?: () => void;
  onNextMonth?: () => void;
  onClose: () => void;
  children: ReactNode;
};

export default function MonthlyDetailOverlay({
  open,
  monthLabel,
  previousMonthLabel,
  nextMonthLabel,
  onPreviousMonth,
  onNextMonth,
  onClose,
  children
}: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    dialogRef.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6" onClick={onClose}>
      <div className="absolute inset-0 bg-[#2D2D2D]/60 backdrop-blur-sm" aria-hidden />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${monthLabel} detail`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative flex h-[94vh] w-full max-w-5xl flex-col overflow-hidden rounded-[28px] border border-warm-border bg-warm-bg-card shadow-[0_24px_60px_rgba(61,46,34,0.25)] outline-none md:h-[92vh]"
      >
        <div className="flex flex-none items-center justify-between gap-4 border-b border-warm-border px-3.5 pt-5 pb-4 md:px-7 md:pt-6 md:pb-5">
          <div className="min-w-0">
            <h2 className="text-[28px] leading-none font-warm-display text-warm-text-primary">{monthLabel}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={onPreviousMonth}
              disabled={!onPreviousMonth}
              aria-label={previousMonthLabel ? `Open ${previousMonthLabel}` : 'Open previous month'}
              title={previousMonthLabel ?? 'Previous month'}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-warm-border bg-warm-bg-card-soft text-warm-text-secondary shadow-sm hover:border-warm-accent/40 hover:text-warm-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-warm-border disabled:hover:text-warm-text-secondary"
            >
              <ChevronLeft size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onNextMonth}
              disabled={!onNextMonth}
              aria-label={nextMonthLabel ? `Open ${nextMonthLabel}` : 'Open next month'}
              title={nextMonthLabel ?? 'Next month'}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-warm-border bg-warm-bg-card-soft text-warm-text-secondary shadow-sm hover:border-warm-accent/40 hover:text-warm-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:border-warm-border disabled:hover:text-warm-text-secondary"
            >
              <ChevronRight size={18} aria-hidden />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-10 w-10 items-center justify-center rounded-full border border-warm-border bg-warm-bg-card-soft text-warm-text-secondary shadow-sm hover:text-warm-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-warm-accent"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-3.5 py-5 md:px-7 md:py-6">{children}</div>
      </div>
    </div>,
    document.body
  );
}
