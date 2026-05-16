import { formatCurrency } from '@/lib/budget';

interface Props {
  contribTotal: number;
  interestCharged: number;
  principalPaid: number;
  debt1: number;
  debt2: number;
  equity: number;
}

export default function MonthMortgageSection({
  contribTotal,
  interestCharged,
  principalPaid,
  debt1,
  debt2,
  equity
}: Props) {
  return (
    <section className="rounded-3xl bg-warm-section-mortgage p-5 flex-1 min-w-0 flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-[22px] leading-tight font-warm-display text-warm-text-primary">
          Mortgage
        </h3>
        <span className="text-sm font-warm-display text-warm-text-primary">
          {formatCurrency(contribTotal)}
        </span>
      </header>

      <div className="rounded-2xl bg-warm-bg-card p-4">
        <h4 className="text-[13px] font-bold text-warm-text-primary mb-2">
          Payment split
        </h4>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Interest charged</span>
            <span className="text-warm-text-primary">
              {formatCurrency(interestCharged)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Principal paid</span>
            <span className="text-warm-text-primary">
              {formatCurrency(principalPaid)}
            </span>
          </li>
        </ul>
      </div>

      <div className="rounded-2xl bg-warm-bg-card p-4">
        <h4 className="text-[13px] font-bold text-warm-text-primary mb-2">
          Debt and equity context
        </h4>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Debt 1</span>
            <span className="text-warm-text-primary">
              {formatCurrency(debt1)}
            </span>
          </li>
          <li className="flex justify-between">
            <span className="text-warm-text-secondary">Debt 2</span>
            <span className="text-warm-text-primary">
              {formatCurrency(debt2)}
            </span>
          </li>
          <li className="flex justify-between font-medium">
            <span className="text-warm-text-primary">House equity</span>
            <span className="text-warm-text-primary">
              {formatCurrency(equity)}
            </span>
          </li>
        </ul>
      </div>
    </section>
  );
}
