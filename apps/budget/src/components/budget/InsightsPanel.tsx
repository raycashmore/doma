import { Sparkles } from 'lucide-react';

export default function InsightsPanel() {
  return (
    <aside className="hidden min-h-0 flex-col gap-3 md:flex md:w-[380px] md:shrink-0">
      <h2 className="text-base font-warm-display text-warm-text-primary px-1">
        Insights
      </h2>
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl bg-warm-bg-card-soft p-8 text-center">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-warm-bg-card text-warm-accent">
          <Sparkles size={22} />
        </div>
        <p className="text-sm font-medium text-warm-text-primary">
          Insights coming soon
        </p>
        <p className="text-xs text-warm-text-secondary">
          Personalised tips about your spending will appear here.
        </p>
      </div>
    </aside>
  );
}
