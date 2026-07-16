import { describe, expect, it } from 'vitest';

import { MEALS_BASE_PATH, MEALS_BASE_URL, getMealsBasePath, getMealsBaseUrl } from './basePath';

describe('Meals deployment base path', () => {
  it('uses the local app root in development and the Meals zone in production', () => {
    expect(MEALS_BASE_PATH).toBe('/meals');
    expect(MEALS_BASE_URL).toBe('/meals/');
    expect(getMealsBasePath(true)).toBe('/');
    expect(getMealsBasePath(false)).toBe('/meals');
    expect(getMealsBaseUrl(true)).toBe('/');
    expect(getMealsBaseUrl(false)).toBe('/meals/');
  });
});
