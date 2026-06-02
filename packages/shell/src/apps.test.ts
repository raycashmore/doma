import { describe, expect, it } from 'vitest';

import { APPS, getActiveAppId, getAppHref } from './apps';

const budget = APPS.find((a) => a.id === 'budget')!;

describe('getAppHref', () => {
  it('returns the production subpath when not in dev', () => {
    expect(getAppHref(budget, false)).toBe('/budget');
  });

  it('returns the localhost dev-port URL when in dev', () => {
    expect(getAppHref(budget, true)).toBe('http://localhost:3001/');
  });
});

describe('getActiveAppId', () => {
  it('maps the first path segment to an app id', () => {
    expect(getActiveAppId('/budget')).toBe('budget');
    expect(getActiveAppId('/schedule/anything')).toBe('schedule');
    expect(getActiveAppId('/')).toBe('home');
  });

  it('falls back to home for unknown path segments', () => {
    expect(getActiveAppId('/totally-unknown')).toBe('home');
  });
});
