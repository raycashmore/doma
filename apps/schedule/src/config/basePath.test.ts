import { describe, expect, it } from 'vitest';

import { getScheduleAssetUrl, getScheduleBasePath, SCHEDULE_BASE_PATH, SCHEDULE_BASE_URL } from './basePath';

describe('schedule base path helpers', () => {
  it('uses the app subpath in production', () => {
    expect(SCHEDULE_BASE_PATH).toBe('/schedule');
    expect(SCHEDULE_BASE_URL).toBe('/schedule/');
    expect(getScheduleBasePath(false)).toBe('/schedule');
    expect(getScheduleAssetUrl(false, 'favicon.png')).toBe('/schedule/favicon.png');
    expect(getScheduleAssetUrl(false, 'icons/icon.svg')).toBe('/schedule/icons/icon.svg');
  });

  it('serves from root in local development', () => {
    expect(getScheduleBasePath(true)).toBe('');
    expect(getScheduleAssetUrl(true, 'icons/icon.svg')).toBe('/icons/icon.svg');
  });
});
