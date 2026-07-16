import { createRouter } from '@tanstack/react-router';

import { getMealsBasePath } from './config/basePath';
import { routeTree } from './routeTree.gen';

// eslint-disable-next-line turbo/no-undeclared-env-vars
const BASEPATH = getMealsBasePath(import.meta.env.DEV);

export function getRouter() {
  return createRouter({
    routeTree,
    context: {},
    basepath: BASEPATH,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0
  });
}
