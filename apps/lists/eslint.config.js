//  @ts-check

import { svelteConfig } from '@repo/eslint-config/svelte';

/** @type {import("eslint").Linter.Config[]} */
export default [...svelteConfig, { ignores: ['test-results/**', 'playwright-report/**'] }];
