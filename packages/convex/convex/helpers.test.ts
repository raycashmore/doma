import { describe, expect, it } from 'vitest';
import { toCents, fromCents } from './helpers';

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
