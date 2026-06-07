import js from '@eslint/js';
import eslintConfigPrettier from 'eslint-config-prettier';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import turboPlugin from 'eslint-plugin-turbo';
import tseslint from 'typescript-eslint';

// Prefer string-literal union types over enums.
const noEnums = {
  selector: 'TSEnumDeclaration',
  message: 'Prefer string-literal union types over enums.'
};

// Named exports only — flagged via AST since the `import` plugin name is already
// claimed by some downstream configs (e.g. eslint-plugin-import-x in tanstack).
const noDefaultExports = {
  selector: 'ExportDefaultDeclaration',
  message: 'Use named exports instead of a default export.'
};

/**
 * A shared ESLint configuration for the repository.
 *
 * Conventions enforced here are documented in docs/agents/typescript.md.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin
    },
    rules: {
      'turbo/no-undeclared-env-vars': 'error'
    }
  },
  {
    plugins: {
      'simple-import-sort': simpleImportSort
    },
    rules: {
      // Prefer `type` aliases over `interface`.
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      // Use `import type { … }` for type-only imports (pairs with verbatimModuleSyntax).
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'separate-type-imports' }
      ],
      'no-restricted-syntax': ['error', noEnums, noDefaultExports],
      // Keep imports and exports sorted (autofixable).
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error'
    }
  },
  {
    // Framework and tooling files that legitimately require a default export.
    files: [
      '**/*.config.{js,cjs,mjs,ts,mts,cts}',
      '**/app/**',
      '**/pages/**',
      '**/api/**',
      '**/src/app.{js,ts}',
      '**/convex/**',
      '**/middleware.{js,ts}',
      '**/*.d.ts'
    ],
    rules: {
      'no-restricted-syntax': ['error', noEnums]
    }
  },
  {
    ignores: ['dist/**', 'convex/_generated/**']
  }
];
