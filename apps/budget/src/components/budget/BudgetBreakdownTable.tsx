import { formatCurrency } from '@/lib/budget';

export type BreakdownRowData = {
  date: number;
  income: number;
  spend: number;
  mortgage: number;
  net: number;
};

type Props = {
  rows: Array<BreakdownRowData> | undefined;
  onRowClick: (date: number) => void;
};

function monthLabel(date: number): string {
  return new Date(date).toLocaleString('en-AU', {
    month: 'short',
    year: 'numeric'
  });
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2 overflow-hidden">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-10 rounded-xl bg-warm-bg-card-soft animate-pulse" />
      ))}
    </div>
  );
}

export function BudgetBreakdownTable({ rows, onRowClick }: Props) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-3xl border border-warm-border bg-warm-bg-card-soft p-5 md:p-6">
      <h2 className="mb-3 text-[16px] leading-tight font-warm-display text-warm-text-primary">Monthly breakdown</h2>
      {!rows ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <p className="text-sm text-warm-text-secondary">No budget rows.</p>
      ) : (
        <div className="-mx-4 min-h-0 flex-1 overflow-auto px-4">
          <table className="w-full min-w-[420px] text-sm">
            <thead>
              <tr className="text-warm-text-tertiary text-[11px] uppercase tracking-wide">
                <th className="py-1.5 pr-3 text-left font-medium">Month</th>
                <th className="py-1.5 px-3 text-right font-medium">Income</th>
                <th className="py-1.5 px-3 text-right font-medium">Spend</th>
                <th className="py-1.5 px-3 text-right font-medium">Mortgage</th>
                <th className="py-1.5 pl-3 text-right font-medium">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.date}
                  onClick={() => onRowClick(r.date)}
                  className="cursor-pointer border-t border-warm-border hover:bg-warm-bg-card transition-colors"
                >
                  <td className="py-1.5 pr-3 text-warm-text-primary font-medium whitespace-nowrap">
                    {monthLabel(r.date)}
                  </td>
                  <td className="py-1.5 px-3 text-right text-warm-text-primary whitespace-nowrap">
                    {formatCurrency(r.income)}
                  </td>
                  <td className="py-1.5 px-3 text-right text-warm-text-primary whitespace-nowrap">
                    {formatCurrency(r.spend)}
                  </td>
                  <td className="py-1.5 px-3 text-right text-warm-text-secondary whitespace-nowrap">
                    {formatCurrency(r.mortgage)}
                  </td>
                  <td
                    className={`py-1.5 pl-3 text-right font-medium whitespace-nowrap ${
                      r.net >= 0 ? 'text-warm-positive' : 'text-warm-negative'
                    }`}
                  >
                    {r.net >= 0 ? '+' : ''}
                    {formatCurrency(r.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
