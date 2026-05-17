import { Sparkles } from 'lucide-react';

export default function InsightsPanel() {
  return (
    <aside className="hidden min-h-0 flex-col gap-4 md:flex md:w-[380px] md:shrink-0">
      <h2 className="px-1 pt-1 text-[20px] leading-tight font-warm-display text-warm-text-primary tracking-[-0.3px]">
        Insights
      </h2>

      <div className="rounded-2xl bg-warm-section-income px-5 py-4">
        <div className="text-[16px] font-warm-display text-warm-text-primary">
          You're in good shape
        </div>
        <p className="mt-1 text-[12px] leading-snug text-warm-text-secondary">
          Spending is trending down and your savings rate is above the
          recommended 10%. Here's what to focus on next.
        </p>
      </div>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-warm-border bg-warm-bg-card-soft p-8 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-warm-bg-card text-warm-accent">
          <Sparkles size={22} />
        </div>
        <p className="text-sm font-medium text-warm-text-primary">
          Personalised insights coming soon
        </p>
        <p className="text-xs text-warm-text-secondary">
          Tips about your spending will appear here.
        </p>
      </div>
    </aside>
  );
}
