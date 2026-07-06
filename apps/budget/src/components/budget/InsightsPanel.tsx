import { Sparkles } from 'lucide-react';

export type SpendingInsight = {
  monthKey: string;
  headline: string;
  observations: Array<string>;
  prediction: string;
  generatedAt: number;
};

function insightMonthLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number);
  if (!year || !month) return monthKey;
  return new Date(Date.UTC(year, month - 1, 1)).toLocaleString('en-AU', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC'
  });
}

export function InsightsPanel({ insight }: { insight?: SpendingInsight | null }) {
  return (
    <aside className="hidden min-h-0 flex-col gap-4 lg:flex lg:w-[380px] lg:shrink-0">
      <h2 className="px-1 pt-1 text-[18px] leading-tight font-warm-display text-warm-text-primary tracking-[-0.3px]">
        Insights
      </h2>

      {insight ? (
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto rounded-3xl border border-warm-border bg-warm-bg-card-soft p-6">
          <div className="flex items-center gap-2">
            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-warm-bg-card text-warm-accent">
              <Sparkles size={16} />
            </span>
            <span className="text-xs font-medium text-warm-text-secondary">{insightMonthLabel(insight.monthKey)}</span>
          </div>
          <p className="text-sm font-medium text-warm-text-primary">{insight.headline}</p>
          <ul className="flex flex-col gap-2">
            {insight.observations.map((observation) => (
              <li key={observation} className="text-xs leading-relaxed text-warm-text-secondary">
                {observation}
              </li>
            ))}
          </ul>
          <div className="mt-auto rounded-2xl bg-warm-bg-card p-4">
            <p className="text-xs font-medium text-warm-text-primary">Next month</p>
            <p className="mt-1 text-xs leading-relaxed text-warm-text-secondary">{insight.prediction}</p>
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-3xl border border-warm-border bg-warm-bg-card-soft p-8 text-center">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-warm-bg-card text-warm-accent">
            <Sparkles size={22} />
          </div>
          <p className="text-sm font-medium text-warm-text-primary">Personalised insights coming soon</p>
          <p className="text-xs text-warm-text-secondary">Tips about your spending will appear here.</p>
        </div>
      )}
    </aside>
  );
}
