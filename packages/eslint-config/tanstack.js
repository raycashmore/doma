import { config as baseConfig } from './base.js';
import { tanstackConfig } from '@tanstack/eslint-config';
import eslintConfigPrettier from 'eslint-config-prettier';

/**
 * A custom ESLint configuration for libraries that use TanStack
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const tanStackConfig = [
  ...baseConfig,
  eslintConfigPrettier,
  ...tanstackConfig,
  {
    // TanStack's config already enforces import/order; disable our sorter so the
    // two autofixers don't fight.
    rules: {
      'simple-import-sort/imports': 'off',
      'simple-import-sort/exports': 'off'
    }
  }
];
