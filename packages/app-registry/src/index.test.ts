import { describe, expect, it } from 'vitest';

import { APPS, getActiveAppId, getAppHref } from './index';

const budget = APPS.find((app) => app.id === 'budget')!;
const lists = APPS.find((app) => app.id === 'lists')!;

describe('getAppHref', () => {
  it('returns the production path when not in dev', () => {
    expect(getAppHref(budget, false)).toBe('/budget');
  });

  it('returns the dev server origin when in dev', () => {
    expect(getAppHref(budget, true)).toBe('http://localhost:3001/');
  });

  it('resolves the Lists app URL', () => {
    expect(getAppHref(lists, false)).toBe('/lists');
    expect(getAppHref(lists, true)).toBe('http://localhost:3004/');
  });
});

describe('getActiveAppId', () => {
  it('matches app ids from the first path segment', () => {
    expect(getActiveAppId('/budget')).toBe('budget');
    expect(getActiveAppId('/schedule/anything')).toBe('schedule');
    expect(getActiveAppId('/lists')).toBe('lists');
    expect(getActiveAppId('/')).toBe('home');
  });

  it('falls back to home for unknown paths', () => {
    expect(getActiveAppId('/totally-unknown')).toBe('home');
  });
});
