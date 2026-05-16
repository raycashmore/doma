import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import { devtools } from '@tanstack/devtools-vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';

import tailwindcss from '@tailwindcss/vite';
import { nitro } from 'nitro/vite';
import { VitePWA } from 'vite-plugin-pwa';

const config = defineConfig(({ command }) => ({
  // /budget/ base only in production builds. In dev, Vite serves at root on
  // its own port; setting base in dev breaks several TanStack Start + Vite
  // internal handlers (/budget/@react-refresh, /budget/@vite/client, etc.
  // 404 because those endpoints don't honor base in this combo).
  base: command === 'build' ? '/budget/' : '/',
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
      registerType: 'autoUpdate',
      base: '/budget/',
      scope: '/budget/',
      manifest: {
        name: 'Doma Budget',
        short_name: 'Budget',
        start_url: '/budget/',
        scope: '/budget/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#f97316',
        icons: [
          {
            src: '/budget/icons/icon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any'
          }
        ]
      },
      workbox: {
        navigateFallback: '/budget/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
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
