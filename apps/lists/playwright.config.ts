import { defineConfig } from '@playwright/test';

// Runs the dev server with sign-in off, so Lists uses its in-memory preview data
// and needs no Convex backend. The Convex URL only satisfies the startup check.
export default defineConfig({
  testDir: './tests',
  workers: 1,
  retries: 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3417', browserName: 'chromium', trace: 'retain-on-failure' },
  webServer: {
    command: 'vite dev --host 127.0.0.1 --port 3417 --strictPort',
    env: { VITE_CLERK_PUBLISHABLE_KEY: '', VITE_CONVEX_URL: 'http://127.0.0.1:9' },
    url: 'http://127.0.0.1:3417',
    reuseExistingServer: false
  }
});
