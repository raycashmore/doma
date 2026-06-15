import type { MetadataRoute } from 'next';

import { SCHEDULE_BASE_URL } from '@/config/basePath';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Schedule',
    short_name: 'Schedule',
    description: 'Family schedule',
    start_url: SCHEDULE_BASE_URL,
    scope: SCHEDULE_BASE_URL,
    display: 'standalone',
    background_color: '#f7efe3',
    theme_color: '#2d2d2d',
    orientation: 'portrait',
    icons: [
      {
        src: 'icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any'
      },
      {
        src: 'icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any'
      },
      {
        src: 'icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any'
      }
    ]
  };
}
