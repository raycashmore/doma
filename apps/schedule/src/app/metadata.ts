import type { Metadata } from 'next';

import { getScheduleAssetUrl } from '@/config/basePath';

export function createScheduleMetadata(isDev: boolean) {
  return {
    applicationName: 'Schedule',
    title: 'Schedule',
    description: 'Family schedule',
    appleWebApp: { capable: true, title: 'Schedule', statusBarStyle: 'default' },
    formatDetection: { telephone: false },
    icons: [
      { rel: 'icon', url: getScheduleAssetUrl(isDev, 'favicon.png') },
      {
        rel: 'apple-touch-icon',
        url: getScheduleAssetUrl(isDev, 'icons/apple-touch-icon.png'),
        sizes: '180x180'
      }
    ]
  } satisfies Metadata;
}
