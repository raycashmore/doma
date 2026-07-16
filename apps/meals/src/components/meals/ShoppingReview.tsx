import { Send, ShoppingCart, X } from 'lucide-react';

import type { ShoppingRow } from './weeklyMealPlannerModel';

import { cn } from '@/lib/utils';

type ShoppingReviewProps = {
  rows: Array<ShoppingRow>;
  onRemove: (id: string) => void;
  onSend: () => void;
  onClose?: () => void;
};

export function ShoppingReview({ rows, onRemove, onSend, onClose }: ShoppingReviewProps) {
  return (
    <aside
      aria-label="Shopping review"
      className={cn(
        'flex min-h-0 flex-col gap-3 rounded-[20px] border border-warm-border bg-warm-bg-card-soft p-[18px]',
        onClose ? 'fixed inset-x-2 bottom-2 top-28 z-50 shadow-2xl' : 'h-full'
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShoppingCart aria-hidden="true" size={18} />
          <h3 className="font-warm-display text-xl">Shopping cart</h3>
        </div>
        {onClose ? (
          <button
            type="button"
            aria-label="Close shopping review"
            onClick={onClose}
            className="rounded-full bg-meal-sand p-2"
          >
            <X aria-hidden="true" size={15} />
          </button>
        ) : (
          <span className="text-xs font-bold text-warm-text-secondary">{rows.length} items</span>
        )}
      </div>
      <p className="text-[10px] leading-4 text-warm-text-secondary">
        Exact ingredient lines from this week. Remove anything you do not need before the later Lists handoff.
      </p>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {rows.length ? (
          <div className="divide-y divide-warm-border">
            {rows.map((row) => (
              <div key={row.id} className="py-2.5">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 text-[11px]">{row.line}</span>
                  <button
                    type="button"
                    aria-label={`Remove ${row.line}`}
                    onClick={() => onRemove(row.id)}
                    className="shrink-0 rounded-full p-1 text-warm-text-tertiary hover:bg-meal-sand"
                  >
                    <X aria-hidden="true" size={13} />
                  </button>
                </div>
                <span className="mt-0.5 block truncate text-[9px] text-warm-text-tertiary">{row.recipeName}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex h-full min-h-32 flex-col items-center justify-center text-center text-xs text-warm-text-secondary">
            Assign meals to build a shopping review.
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onSend}
        className="flex w-full items-center justify-center gap-2 rounded-full bg-warm-text-primary px-4 py-3 text-xs font-bold text-warm-bg-card-soft"
      >
        <Send aria-hidden="true" size={15} /> Send to Lists
      </button>
      <p className="text-center text-[9px] text-warm-text-secondary">
        Explicit approval will be required before anything is added.
      </p>
    </aside>
  );
}
