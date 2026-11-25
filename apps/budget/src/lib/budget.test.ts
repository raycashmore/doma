import { describe, expect, it } from 'vitest';
import { formatCurrency, formatDateLabel, periodRange } from './budget';

describe('periodRange', () => {
  const months = ['2025-09', '2025-10', '2025-11', '2025-12', '2026-01', '2026-02', '2026-03'].map((monthKey) => ({
    monthKey
  }));

  it('ends at the latest month with data and spans exactly N months (RAY-57)', () => {
    expect(periodRange('3M', months)).toEqual({ from: '2026-01', to: '2026-03' });
    expect(periodRange('6M', months)).toEqual({ from: '2025-10', to: '2026-03' });
  });

  it('crosses year boundaries', () => {
    expect(periodRange('12M', months)).toEqual({ from: '2025-04', to: '2026-03' });
  });

  it('covers every month for All, and nothing without data', () => {
    expect(periodRange('ALL', months)).toEqual({ from: '2025-09', to: '2026-03' });
    expect(periodRange('6M', [])).toBeNull();
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
  it('formats cents as whole AUD with thousands separators', () => {
    expect(formatCurrency(123400)).toBe('$1,234');
  });

  it('rounds half-cents to nearest dollar', () => {
    expect(formatCurrency(123456)).toBe('$1,235');
  });

  it('handles zero', () => {
    expect(formatCurrency(0)).toBe('$0');
  });

  it('handles negatives', () => {
    expect(formatCurrency(-50000)).toBe('-$500');
  });
});
