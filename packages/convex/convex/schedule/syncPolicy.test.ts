import { describe, expect, it } from 'vitest';
import { shouldSkipSync } from './syncPolicy';

const FRESH = 60_000;

describe('shouldSkipSync', () => {
  it('never skips when force is true', () => {
    expect(shouldSkipSync(Date.now(), Date.now(), true, FRESH)).toBe(false);
  });

  it('never skips when there has never been a sync', () => {
    expect(shouldSkipSync(null, Date.now(), false, FRESH)).toBe(false);
  });

  it('skips when the last sync is within the freshness window', () => {
    const now = 1_000_000;
    expect(shouldSkipSync(now - 30_000, now, false, FRESH)).toBe(true);
  });

  it('syncs when the last sync is older than the freshness window', () => {
    const now = 1_000_000;
    expect(shouldSkipSync(now - 90_000, now, false, FRESH)).toBe(false);
  });

  it('syncs exactly at the freshness boundary', () => {
    const now = 1_000_000;
    expect(shouldSkipSync(now - FRESH, now, false, FRESH)).toBe(false);
  });
});
