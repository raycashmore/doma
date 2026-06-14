import globals from 'globals';
import sveltePlugin from 'eslint-plugin-svelte';
import tseslint from 'typescript-eslint';

import { config as baseConfig } from './base.js';

/** @type {import("eslint").Linter.Config[]} */
export const svelteConfig = [
  ...baseConfig,
  ...sveltePlugin.configs['flat/recommended'],
  ...sveltePlugin.configs['flat/prettier'],
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.svelte'],
    languageOptions: {
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte']
      }
    },
    rules: {
      'svelte/no-navigation-without-resolve': 'off',
      'no-restricted-syntax': 'off'
    }
  },
  {
    ignores: ['.svelte-kit/**', 'build/**', '.vercel/**']
  }
];
