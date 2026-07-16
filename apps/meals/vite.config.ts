import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';
import { VitePWA } from 'vite-plugin-pwa';

import { MEALS_BASE_URL, getMealsBaseUrl } from './src/config/basePath';

export default defineConfig(({ command }) => ({
  base: getMealsBaseUrl(command !== 'build'),
  nitro: {
    baseURL: getMealsBaseUrl(command !== 'build')
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    devtools(),
    nitro(),
    viteTsConfigPaths({ projects: ['./tsconfig.json'] }),
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
      base: MEALS_BASE_URL,
      outDir: '.output/public',
      scope: MEALS_BASE_URL,
      manifest: {
        name: 'Meals',
        short_name: 'Meals',
        start_url: MEALS_BASE_URL,
        scope: MEALS_BASE_URL,
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#2d2d2d',
        icons: [
          {
            src: `${MEALS_BASE_URL}icons/icon.svg`,
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          },
          {
            src: `${MEALS_BASE_URL}icons/icon-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: `${MEALS_BASE_URL}icons/icon-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: `${MEALS_BASE_URL}icons/icon-maskable-192.png`,
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable'
          },
          {
            src: `${MEALS_BASE_URL}icons/icon-maskable-512.png`,
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.convex\.cloud\/.*$/,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
}));
