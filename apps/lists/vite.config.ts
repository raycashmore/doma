import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const LISTS_BASE_URL = '/lists/';
const DEV_LISTS_BASE_URL = '/';

export default defineConfig(({ command }) => {
  const listsBaseUrl = command === 'build' ? LISTS_BASE_URL : DEV_LISTS_BASE_URL;

  return {
    plugins: [
      sveltekit(),
      VitePWA({
        injectRegister: false,
        registerType: 'autoUpdate',
        base: listsBaseUrl,
        scope: listsBaseUrl,
        manifest: {
          name: 'Lists',
          short_name: 'Lists',
          description: 'Reusable household checklists',
          start_url: listsBaseUrl,
          scope: listsBaseUrl,
          display: 'standalone',
          background_color: '#ffffff',
          theme_color: '#2d2d2d',
          icons: [
            {
              src: `${listsBaseUrl}icons/icon.svg`,
              sizes: 'any',
              type: 'image/svg+xml',
              purpose: 'any'
            },
            {
              src: `${listsBaseUrl}icons/icon-192.png`,
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: `${listsBaseUrl}icons/icon-512.png`,
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,webmanifest}'],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/.*\.convex\.cloud\/.*/,
              handler: 'NetworkOnly'
            }
          ]
        }
      })
    ],
    server: {
      port: 3004
    }
  };
});
