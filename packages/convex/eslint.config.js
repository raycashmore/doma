// @ts-check

import { config } from '@repo/eslint-config/base';

/** @type {import("eslint").Linter.Config[]} */
export default [{ ignores: ['convex/_generated/**'] }, ...config];
