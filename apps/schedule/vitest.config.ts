import { URL, fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Next's tsconfig uses `jsx: preserve`, so esbuild would otherwise fall back
  // to the classic runtime (which needs `React` in scope). Force the automatic
  // runtime so test JSX transforms without an explicit React import.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.{test,spec}.{ts,tsx}']
  }
});
