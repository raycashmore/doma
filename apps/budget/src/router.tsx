import { createRouter } from '@tanstack/react-router';

import { routeTree } from './routeTree.gen';

// In dev, Budget serves at the root of its own port (localhost:3000/). In
// production, Vercel rewrites mount it under /budget on the apex domain.
// The basepath needs to match wherever the app is served.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const BASEPATH = (import.meta as any).env.DEV ? '/' : '/budget';

export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {},
    basepath: BASEPATH,
    scrollRestoration: true,
    defaultPreloadStaleTime: 0
  });

  return router;
};
