import { describe, expect, it } from 'vitest';
import {
  computeMovingAverage,
  filterByTimePeriod,
  formatCurrency,
  formatDateLabel
} from './budget';

describe('computeMovingAverage', () => {
  it('returns same values for window=1', () => {
    expect(computeMovingAverage([10, 20, 30], 1)).toEqual([10, 20, 30]);
  });

  it('computes expanding window for early points', () => {
    const result = computeMovingAverage([10, 20, 30, 40], 3);
    expect(result[0]).toBeCloseTo(10); // avg of [10]
    expect(result[1]).toBeCloseTo(15); // avg of [10, 20]
    expect(result[2]).toBeCloseTo(20); // avg of [10, 20, 30]
    expect(result[3]).toBeCloseTo(30); // avg of [20, 30, 40]
  });

  it('returns empty array for empty input', () => {
    expect(computeMovingAverage([], 3)).toEqual([]);
  });

  it('handles window larger than data', () => {
    const result = computeMovingAverage([10, 20], 5);
    expect(result[0]).toBeCloseTo(10);
    expect(result[1]).toBeCloseTo(15);
  });
});

describe('filterByTimePeriod', () => {
  const now = Date.now();
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;

  const data = [
    { date: now - 6 * msPerYear, value: 1 },
    { date: now - 4 * msPerYear, value: 2 },
    { date: now - 2 * msPerYear, value: 3 },
    { date: now - 0.5 * msPerYear, value: 4 }
  ];

  it('returns all data for ALL', () => {
    expect(filterByTimePeriod(data, 'ALL')).toHaveLength(4);
  });

  it('filters to last 1 year', () => {
    const result = filterByTimePeriod(data, '1Y');
    expect(result).toHaveLength(1);
    expect(result[0].value).toBe(4);
  });

  it('filters to last 3 years', () => {
    const result = filterByTimePeriod(data, '3Y');
    expect(result).toHaveLength(2);
  });

  it('filters to last 5 years', () => {
    const result = filterByTimePeriod(data, '5Y');
    expect(result).toHaveLength(3);
  });
});

describe('formatDateLabel', () => {
  it('formats as DD/MM/YYYY', () => {
    // 15 March 2024 UTC
    const ts = Date.UTC(2024, 2, 15);
    const result = formatDateLabel(ts);
    expect(result).toMatch(/15\/03\/2024/);
  });

  it('pads single-digit day and month', () => {
    const ts = Date.UTC(2024, 0, 5);
    const result = formatDateLabel(ts);
    expect(result).toMatch(/05\/01\/2024/);
  });
});

describe('formatCurrency', () => {
  it('formats positive values with dollar sign', () => {
    expect(formatCurrency(1234)).toBe('$1,234');
  });

  it('rounds to nearest integer', () => {
    expect(formatCurrency(1234.56)).toBe('$1,235');
  });

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });
});
