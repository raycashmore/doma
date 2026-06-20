import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [sveltekit()],
  resolve: {
    conditions: ['browser']
  },
  test: {
    environment: 'jsdom',
    env: {
      VITE_CLERK_PUBLISHABLE_KEY: 'pk_test_lists'
    },
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    restoreMocks: true
  }
});
