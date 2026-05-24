import { describe, expect, it } from 'vitest';
import {
  budgetCaptureDatesFromCaptureDate,
  budgetDisplayMonthEndFromCaptureDate
} from './budgetDisplayMonth';

describe('budgetDisplayMonthEndFromCaptureDate', () => {
  it('maps a capture date to the previous month end in UTC', () => {
    expect(
      new Date(
        budgetDisplayMonthEndFromCaptureDate(Date.UTC(2026, 4, 10))
      ).toISOString()
    ).toBe('2026-04-30T00:00:00.000Z');
  });

  it('crosses the year boundary for January captures', () => {
    expect(
      new Date(
        budgetDisplayMonthEndFromCaptureDate(Date.UTC(2026, 0, 10))
      ).toISOString()
    ).toBe('2025-12-31T00:00:00.000Z');
  });

  it('keeps the original capture date with the display month date', () => {
    const captureDate = Date.UTC(2026, 4, 10);

    expect(budgetCaptureDatesFromCaptureDate(captureDate)).toEqual({
      date: Date.UTC(2026, 3, 30),
      captureDate
    });
  });
});
