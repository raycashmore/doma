import { describe, expect, it } from 'vitest';
import {
  excelDateToTimestamp,
  parseSpendingSummaryRows
} from './spendingSummary';

describe('parseSpendingSummaryRows', () => {
  it('imports every dated column from Spending summary as flexible category rows', () => {
    const rows = parseSpendingSummaryRows([
      [undefined, 45_412, 45_443, 'not a date'],
      [' Category A ', 12.34, undefined, 99],
      ['Category B', 0, 56.78, 99],
      ['Category C', '', 90, 99]
    ]);

    expect(rows).toEqual([
      {
        monthKey: '2024-04',
        sourceDate: excelDateToTimestamp(45_412),
        category: 'Category A',
        amount: 1234
      },
      {
        monthKey: '2024-05',
        sourceDate: excelDateToTimestamp(45_443),
        category: 'Category B',
        amount: 5678
      },
      {
        monthKey: '2024-05',
        sourceDate: excelDateToTimestamp(45_443),
        category: 'Category C',
        amount: 9000
      }
    ]);
  });
});
