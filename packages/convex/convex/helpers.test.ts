import { describe, expect, it } from 'vitest';
import {
  budgetMortgagePortion,
  budgetTotalOut,
  currentAccountTotal,
  toCents,
  fromCents,
  mortgageConfigForTotals,
  mortgageEquity,
  mortgagePaymentTotal,
  mortgagePrincipalPaid,
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
    expect(
      Number.isInteger(
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
      )
    ).toBe(true);
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

describe('refactored mortgage and budget helpers', () => {
  const mortgage = {
    _id: 'm' as any,
    _creationTime: 0,
    date: 0,
    debt1: 30_000_000,
    debt2: 10_000_000,
    fixedPayment: 240_000,
    variablePayment: 150_000,
    rateVar: 6.12,
    rateFixed: 5.49,
    offset1: 25_000_000,
    offset2: 2_500_000
  };

  const config = {
    _id: 'cfg' as any,
    _creationTime: 0,
    key: 'default' as const,
    price: 80_000_000,
    deposit: 18_400_000,
    familyContrib: 3_500_000,
    contrib1: 100_000,
    contrib2: 120_000,
    contrib3: 72_000,
    loanValue: 90_000_000
  };

  it('uses sharedOut for budget total out', () => {
    expect(
      budgetTotalOut({
        _id: 'b' as any,
        _creationTime: 0,
        date: 0,
        incomePrimary: 0,
        incomeSecondary: 0,
        billContrib: 0,
        credit1: 10_000,
        credit2: 20_000,
        credit3: 30_000,
        oneOffs: 40_000,
        sharedOut: 50_000,
        rent: 0
      } as any)
    ).toBe(150_000);
  });

  it('includes currency in current account totals', () => {
    expect(
      currentAccountTotal({
        _id: 'c' as any,
        _creationTime: 0,
        date: 0,
        currentSecondary: 10_000,
        shared: 20_000,
        currentPrimary: 30_000,
        other: 40_000,
        currency: 50_000
      } as any)
    ).toBe(150_000);
  });

  it('derives mortgage payment total from mortgage fixed and variable payment fields', () => {
    expect(mortgagePaymentTotal(mortgage as any)).toBe(390_000);
    expect(budgetMortgagePortion(mortgage as any)).toBe(390_000);
  });

  it('derives equity from mortgage config price', () => {
    expect(mortgageEquity(mortgage as any, config)).toBe(40_000_000);
  });

  it('normalizes missing config to zeros for totals guards', () => {
    expect(mortgageConfigForTotals(null)).toEqual({
      price: 0,
      deposit: 0,
      familyContrib: 0,
      contrib1: 0,
      contrib2: 0,
      contrib3: 0,
      loanValue: 0
    });
  });

  it('derives principal paid from payment minus interest estimate', () => {
    expect(mortgagePrincipalPaid(mortgage as any)).toBe(0);
  });
});
