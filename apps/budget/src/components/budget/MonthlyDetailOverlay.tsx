import {  useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type {ReactNode} from 'react';

interface Props {
  open: boolean;
  monthLabel: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
}

export default function MonthlyDetailOverlay({
  open,
  monthLabel,
  subtitle,
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
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-12"
      onClick={onClose}
    >
      <div
        className="absolute inset-0 bg-[#2D2D2D]/60 backdrop-blur-sm"
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${monthLabel} detail`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[90vh] overflow-auto rounded-[28px] bg-warm-bg-card p-7 shadow-[0_24px_60px_rgba(61,46,34,0.25)] border border-warm-border outline-none"
      >
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-[14px] bg-warm-section-spend text-warm-accent">
              <span aria-hidden className="text-base font-warm-display">
                $
              </span>
            </div>
            <div>
              <h2 className="text-2xl font-warm-display text-warm-text-primary">
                {monthLabel}
              </h2>
              {subtitle ? (
                <p className="text-xs text-warm-text-secondary mt-0.5">
                  {subtitle}
                </p>
              ) : null}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex items-center justify-center w-10 h-10 rounded-full bg-warm-bg-card-soft border border-warm-border text-warm-text-secondary hover:text-warm-text-primary"
          >
            <X size={18} aria-hidden />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  );
}
