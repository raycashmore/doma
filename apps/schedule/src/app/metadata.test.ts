import { describe, expect, it } from 'vitest';

import { createScheduleMetadata } from './metadata';

describe('Schedule metadata', () => {
  it('points production browser icons at the Schedule zone', () => {
    const metadata = createScheduleMetadata(false);

    expect(metadata.icons).toEqual([
      { rel: 'icon', url: '/schedule/favicon.png' },
      {
        rel: 'apple-touch-icon',
        url: '/schedule/icons/apple-touch-icon.png',
        sizes: '180x180'
      }
    ]);
  });
});
