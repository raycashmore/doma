import { formatCurrency } from '@/lib/budget';

export interface BreakdownRowData {
  date: number;
  income: number;
  spend: number;
  mortgage: number | null;
  net: number;
}

interface Props {
  rows: Array<BreakdownRowData> | undefined;
  onRowClick: (date: number) => void;
}

function monthLabel(date: number): string {
  return new Date(date).toLocaleString('en-AU', {
    month: 'short',
    year: 'numeric'
  });
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="h-10 rounded-xl bg-warm-bg-card-soft animate-pulse"
        />
      ))}
    </div>
  );
}

export default function BudgetBreakdownTable({ rows, onRowClick }: Props) {
  return (
    <div className="rounded-3xl bg-warm-bg-card-soft p-5">
      <h2 className="text-base font-warm-display text-warm-text-primary mb-3">
        Monthly breakdown
      </h2>
      {!rows ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <p className="text-sm text-warm-text-secondary">No budget rows.</p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-warm-text-tertiary text-[11px] uppercase tracking-wide">
              <th className="text-left font-medium py-2">Month</th>
              <th className="text-right font-medium py-2">Income</th>
              <th className="text-right font-medium py-2">Spend</th>
              <th className="text-right font-medium py-2">Mortgage</th>
              <th className="text-right font-medium py-2">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.date}
                onClick={() => onRowClick(r.date)}
                className="cursor-pointer border-t border-warm-border hover:bg-warm-bg-card transition-colors"
              >
                <td className="py-2 text-warm-text-primary font-medium">
                  {monthLabel(r.date)}
                </td>
                <td className="py-2 text-right text-warm-text-primary">
                  {formatCurrency(r.income)}
                </td>
                <td className="py-2 text-right text-warm-text-primary">
                  {formatCurrency(r.spend)}
                </td>
                <td className="py-2 text-right text-warm-text-secondary">
                  {r.mortgage === null ? '—' : formatCurrency(r.mortgage)}
                </td>
                <td
                  className={`py-2 text-right font-medium ${
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
      )}
    </div>
  );
}
