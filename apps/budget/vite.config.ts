import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';

import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';
import { VitePWA } from 'vite-plugin-pwa';

import { BUDGET_BASE_URL, getBudgetBaseUrl } from './src/config/basePath';

const config = defineConfig(({ command }) => ({
  // /budget/ base only in production builds. In dev, Vite serves at root on
  // its own port; setting base in dev breaks several TanStack Start + Vite
  // internal handlers (/budget/@react-refresh, /budget/@vite/client, etc.
  // 404 because those endpoints don't honor base in this combo).
  base: getBudgetBaseUrl(command !== 'build'),
  nitro: {
    baseURL: getBudgetBaseUrl(command !== 'build')
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    devtools(),
    nitro(),
    viteTsConfigPaths({
      projects: ['./tsconfig.json']
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact({
      babel: {
        plugins: ['babel-plugin-react-compiler']
      }
    }),
    VitePWA({
      injectRegister: false,
      registerType: 'prompt',
      base: BUDGET_BASE_URL,
      outDir: '.output/public',
      scope: BUDGET_BASE_URL,
      manifest: {
        name: 'Budget',
        short_name: 'Budget',
        start_url: BUDGET_BASE_URL,
        scope: BUDGET_BASE_URL,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2d2d2d',
        icons: [
          {
            src: `${BUDGET_BASE_URL}icons/icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: `${BUDGET_BASE_URL}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: `${BUDGET_BASE_URL}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: `${BUDGET_BASE_URL}icons/icon-maskable-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: `${BUDGET_BASE_URL}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        // Exclude webmanifest from globbing: vite-plugin-pwa already adds the
        // manifest to the precache from its `manifest` config, so globbing the
        // emitted `manifest.webmanifest` too produces a duplicate precache entry
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
  ]
}));

export default config;
