import { config } from '@repo/eslint-config/base';
export default [
  ...config,
  { ignores: ['.vitepress/dist/**', '.vitepress/cache/**', 'test-results/**', 'playwright-report/**'] }
];
