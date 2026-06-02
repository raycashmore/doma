import { Sparkles } from 'lucide-react';

export default function InsightsPanel() {
  return (
    <aside className="hidden min-h-0 flex-col gap-4 lg:flex lg:w-[380px] lg:shrink-0">
      <h2 className="px-1 pt-1 text-[20px] leading-tight font-warm-display text-warm-text-primary tracking-[-0.3px]">
        Insights
      </h2>

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-warm-border bg-warm-bg-card-soft p-8 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-warm-bg-card text-warm-accent">
          <Sparkles size={22} />
        </div>
        <p className="text-sm font-medium text-warm-text-primary">Personalised insights coming soon</p>
        <p className="text-xs text-warm-text-secondary">Tips about your spending will appear here.</p>
      </div>
    </aside>
  );
}
