'use client';

import { RefreshCw } from 'lucide-react';

export type PwaUpdateToastProps = {
  show: boolean;
  onReload: () => void;
};

export function PwaUpdateToast({ show, onReload }: PwaUpdateToastProps) {
  if (!show) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-0 bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex w-[calc(100%-2rem)] max-w-sm items-center gap-3 rounded-2xl border border-warm-border bg-warm-bg-dark-muted px-4 py-3 text-warm-text-on-dark shadow-lg md:bottom-[max(1rem,env(safe-area-inset-bottom))]"
    >
      <RefreshCw className="size-4 shrink-0 text-warm-accent" aria-hidden="true" />
      <span className="flex-1 text-sm">A new version is available.</span>
      <button
        type="button"
        onClick={onReload}
        className="rounded-lg bg-warm-accent px-3 py-1 text-sm font-medium text-warm-bg transition-opacity hover:opacity-90"
      >
        Reload
      </button>
    </div>
  );
}
