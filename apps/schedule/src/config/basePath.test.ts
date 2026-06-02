import { describe, expect, it } from 'vitest';

import { getScheduleBasePath, SCHEDULE_BASE_PATH, SCHEDULE_BASE_URL } from './basePath';

describe('schedule base path helpers', () => {
  it('uses the app subpath in production', () => {
    expect(SCHEDULE_BASE_PATH).toBe('/schedule');
    expect(SCHEDULE_BASE_URL).toBe('/schedule/');
    expect(getScheduleBasePath(false)).toBe('/schedule');
  });

  it('serves from root in local development', () => {
    expect(getScheduleBasePath(true)).toBe('');
  });
});
