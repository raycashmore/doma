import { toCents } from './helpers';

export interface SpendCategorySeedRow {
  monthKey: string;
  sourceDate: number;
  category: string;
  amount: number;
}

const MS_PER_DAY = 86_400_000;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

export function excelDateToTimestamp(excelDate: number): number {
  return EXCEL_EPOCH + excelDate * MS_PER_DAY;
}

export function monthKeyFromTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function num(val: unknown): number {
  if (val === '' || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

export function parseSpendingSummaryRows(
  data: unknown[][]
): SpendCategorySeedRow[] {
  const [header, ...categoryRows] = data;
  if (!header) return [];

  const datedColumns = header
    .map((value, index) => ({ value, index }))
    .filter(
      (column): column is { value: number; index: number } =>
        typeof column.value === 'number'
    );

  const rows: SpendCategorySeedRow[] = [];
  for (const row of categoryRows) {
    const category = typeof row[0] === 'string' ? row[0].trim() : '';
    if (!category) continue;

    for (const column of datedColumns) {
      const rawAmount = num(row[column.index]);
      if (rawAmount <= 0) continue;

      rows.push({
        monthKey: monthKeyFromTimestamp(excelDateToTimestamp(column.value)),
        sourceDate: excelDateToTimestamp(column.value),
        category,
        amount: toCents(rawAmount)
      });
    }
  }

  return rows;
}
