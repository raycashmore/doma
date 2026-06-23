import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const LISTS_BASE_URL = '/lists/';
const DEV_LISTS_BASE_URL = '/';

export default defineConfig(({ command }) => {
  const listsBaseUrl = command === 'build' ? LISTS_BASE_URL : DEV_LISTS_BASE_URL;

  return {
    plugins: [
      tailwindcss(),
      sveltekit(),
      VitePWA({
        injectRegister: false,
        registerType: 'prompt',
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
          // Exclude webmanifest from globbing: vite-plugin-pwa already adds the
          // manifest to the precache from its `manifest` config, so globbing the
          // static `manifest.webmanifest` too produces a duplicate precache entry
          // with a conflicting revision (add-to-cache-list-conflicting-entries).
          globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
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
