export type SpendingInsightRow = {
  monthKey: string;
  headline: string;
  observations: string[];
  prediction: string;
  generatedAt: number;
  model: string;
};

export function pickLatestSpendingInsight<T extends SpendingInsightRow>(rows: T[]): T | null {
  let latest: T | null = null;
  for (const row of rows) {
    if (!latest || row.monthKey > latest.monthKey) {
      latest = row;
    }
  }
  return latest;
}
