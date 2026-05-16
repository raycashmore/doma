export type TimePeriod = '1Y' | '3Y' | '5Y' | 'ALL';

export interface BudgetDataPoint {
  date: number;
  spend: number;
  sinkOrSwim: number;
}

export function computeMovingAverage(
  values: Array<number>,
  window: number
): Array<number> {
  const result: Array<number> = [];
  let sum = 0;

  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= window) {
      sum -= values[i - window];
      result.push(sum / window);
    } else {
      result.push(sum / (i + 1));
    }
  }

  return result;
}

export function filterByTimePeriod<T extends { date: number }>(
  data: Array<T>,
  period: TimePeriod
): Array<T> {
  if (period === 'ALL') return data;

  const now = Date.now();
  const years = period === '1Y' ? 1 : period === '3Y' ? 3 : 5;
  const cutoff = now - years * 365.25 * 24 * 60 * 60 * 1000;

  return data.filter((d) => d.date >= cutoff);
}

export function formatDateLabel(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

export function formatCurrency(cents: number): string {
  const dollars = Math.round(cents / 100);
  if (dollars < 0) {
    return `-$${Math.abs(dollars).toLocaleString('en-AU')}`;
  }
  return `$${dollars.toLocaleString('en-AU')}`;
}
