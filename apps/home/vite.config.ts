import { fileURLToPath, URL } from 'node:url';

import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

import { HOME_NAVIGATION_DENYLIST } from './src/config/pwa';

export default defineConfig({
  base: '/',
  build: {
    outDir: '.output/public',
    emptyOutDir: true
  },
  server: {
    proxy: {
      '/api/bot': {
        // eslint-disable-next-line turbo/no-undeclared-env-vars
        target: process.env.BOT_GATEWAY_DEV_ORIGIN ?? 'http://localhost:3002',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/bot/, '') || '/'
      }
    }
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  plugins: [
    vue(),
    VitePWA({
      injectRegister: false,
      registerType: 'autoUpdate',
      base: '/',
      outDir: '.output/public',
      scope: '/',
      manifest: {
        name: 'Noticeboard',
        short_name: 'Noticeboard',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#2d2d2d',
        theme_color: '#2d2d2d',
        icons: [
          { src: '/icons/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        navigateFallbackDenylist: HOME_NAVIGATION_DENYLIST,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.convex\.cloud\/.*$/,
            handler: 'NetworkOnly'
          }
        ]
      }
    })
  ]
});
