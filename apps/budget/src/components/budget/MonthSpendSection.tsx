import { formatCurrency } from '@/lib/budget';

interface Props {
  credit1: number;
  credit2: number;
  credit3: number;
  oneOffs: number;
}

const CATEGORY_STUBS = ['Groceries', 'Dining out', 'Transport', 'Retail, bills & health'];

export default function MonthSpendSection({
  credit1,
  credit2,
  credit3,
  oneOffs
}: Props) {
  const creditSubtotal = credit1 + credit2 + credit3;
  const total = creditSubtotal + oneOffs;

  return (
    <section className="rounded-3xl bg-warm-section-spend p-5 flex-1 min-w-0 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-warm-text-primary">Spend</h3>
        <span className="text-sm font-warm-display text-warm-text-primary">
          {formatCurrency(total)}
        </span>
      </header>

      <div className="rounded-2xl bg-warm-bg-card p-4">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wide text-warm-text-secondary mb-2">
          <span>Credit card categories</span>
          <span>{formatCurrency(creditSubtotal)}</span>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          {CATEGORY_STUBS.map((cat) => (
            <li key={cat} className="flex justify-between">
              <span className="text-warm-text-secondary">{cat}</span>
              <span className="text-warm-text-tertiary">—</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="rounded-2xl bg-warm-bg-card p-4 flex items-center justify-between text-sm">
        <span className="text-warm-text-secondary font-medium">One-offs</span>
        <span className="text-warm-text-primary">{formatCurrency(oneOffs)}</span>
      </div>
    </section>
  );
}
