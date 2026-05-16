import { describe, expect, it } from 'vitest';
import {
  toCents,
  fromCents,
  superPensionAud,
  ukTotalAud,
  investmentTotal
} from './helpers';

describe('toCents', () => {
  it('converts whole dollars to cents', () => {
    expect(toCents(10)).toBe(1000);
  });

  it('converts fractional dollars to cents with rounding', () => {
    expect(toCents(10.005)).toBe(1001);
    expect(toCents(10.004)).toBe(1000);
  });

  it('handles zero and negatives', () => {
    expect(toCents(0)).toBe(0);
    expect(toCents(-2.5)).toBe(-250);
  });
});

describe('fromCents', () => {
  it('converts cents back to dollars', () => {
    expect(fromCents(1000)).toBe(10);
    expect(fromCents(1234)).toBe(12.34);
  });

  it('handles zero and negatives', () => {
    expect(fromCents(0)).toBe(0);
    expect(fromCents(-250)).toBe(-2.5);
  });
});

describe('rate-boundary rounding (returns integer cents)', () => {
  it('superPensionAud rounds to integer cents', () => {
    // 100,000 pence (£1000) * 1.95 = 195,000 cents
    expect(
      superPensionAud({
        _id: 'x' as any,
        _creationTime: 0,
        date: 0,
        pension: 100_000,
        super1: 0,
        super2: 0,
        super3: 0,
        gbpAud: 1.95
      })
    ).toBe(195_000);
  });

  it('superPensionAud rounds fractional cents', () => {
    // 100 pence * 1.234 = 123.4 cents -> 123
    expect(
      superPensionAud({
        _id: 'x' as any,
        _creationTime: 0,
        date: 0,
        pension: 100,
        super1: 0,
        super2: 0,
        super3: 0,
        gbpAud: 1.234
      })
    ).toBe(123);
    expect(Number.isInteger(
      superPensionAud({
        _id: 'x' as any,
        _creationTime: 0,
        date: 0,
        pension: 99,
        super1: 0,
        super2: 0,
        super3: 0,
        gbpAud: 1.987
      })
    )).toBe(true);
  });

  it('ukTotalAud returns integer cents', () => {
    const row = {
      _id: 'x' as any,
      _creationTime: 0,
      date: 0,
      currentGbp: 10_000,
      saverGbp: 20_000,
      cashIsaGbp: 30_000,
      sharesIsaGbp: 40_000,
      gbpAud: 1.95
    };
    // 100,000 pence * 1.95 = 195,000 cents
    expect(ukTotalAud(row)).toBe(195_000);
  });

  it('investmentTotal returns integer cents', () => {
    const row = {
      _id: 'x' as any,
      _creationTime: 0,
      date: 0,
      managedFund1: 1_000_000,
      investmentLoan: -500_000,
      tradingAus1: 100_000,
      tradingInt1: 50_000,
      tradingInt2: 80_000, // USD cents
      usdAud: 1.55,
      managedFund2: 0,
      tradingAus2: 0,
      managedFund3: 0,
      crypto1: 0,
      crypto2: 0
    };
    // tradingInt2 * usdAud = 80000 * 1.55 = 124000 cents
    // total = 500000 + 100000 + 50000 + 124000 = 774000
    expect(investmentTotal(row)).toBe(774_000);
    expect(Number.isInteger(investmentTotal(row))).toBe(true);
  });
});
