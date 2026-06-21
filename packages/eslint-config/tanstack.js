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
    // The flat-config file isn't part of any tsconfig program, so TanStack's
    // type-aware parser (`parserOptions.project: true`) can't resolve it. It
    // needs no linting of its own — ignore it globally.
    ignores: ['eslint.config.js']
  },
  {
    // TanStack's config already enforces import/order; disable our sorter so the
    // two autofixers don't fight.
    rules: {
      'simple-import-sort/imports': 'off',
      'simple-import-sort/exports': 'off'
    }
  }
];
