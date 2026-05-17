import { formatCurrency } from '@/lib/budget';

interface Props {
  primary: number;
  secondary: number;
  billContrib: number;
}

export default function MonthIncomeSection({
  primary,
  secondary,
  billContrib
}: Props) {
  return (
    <section className="rounded-3xl bg-warm-section-income p-5 flex-1 min-w-0 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-[22px] leading-tight font-warm-display text-warm-text-primary">
          Income
        </h3>
        <span className="text-sm font-warm-display text-warm-text-primary">
          {formatCurrency(primary + secondary + billContrib)}
        </span>
      </header>
      <div className="rounded-2xl bg-warm-bg-card p-4">
        <h4 className="text-[13px] font-bold text-warm-text-primary mb-2">
          Income contributors
        </h4>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Primary</span>
            <span className="text-warm-text-primary">
              {formatCurrency(primary)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Secondary</span>
            <span className="text-warm-text-primary">
              {formatCurrency(secondary)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Bill contributions</span>
            <span className="text-warm-text-primary">
              {formatCurrency(billContrib)}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
