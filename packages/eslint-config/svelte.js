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
    // `.svelte.ts`/`.svelte.js` are rune-enabled module files: the svelte parser
    // handles them but needs the TS parser as its script sub-parser.
    files: ['**/*.svelte', '**/*.svelte.ts', '**/*.svelte.js'],
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
