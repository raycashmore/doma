import { describe, expect, it } from 'vitest';

import { BUDGET_BASE_PATH, BUDGET_BASE_URL, getBudgetBasePath, getBudgetBaseUrl } from './basePath';

describe('budget base path helpers', () => {
  it('uses the app subpath in production', () => {
    expect(BUDGET_BASE_PATH).toBe('/budget');
    expect(BUDGET_BASE_URL).toBe('/budget/');
    expect(getBudgetBasePath(false)).toBe('/budget');
    expect(getBudgetBaseUrl(false)).toBe('/budget/');
  });

  it('serves from root in local development', () => {
    expect(getBudgetBasePath(true)).toBe('/');
    expect(getBudgetBaseUrl(true)).toBe('/');
  });
});
