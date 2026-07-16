import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { AppFrame, PwaUpdater } from '@repo/shell';

import appCss from '../styles.css?url';
import { AuthGate } from '@/integrations/auth/AuthGate';
import { getMealsBaseUrl } from '@/config/basePath';
import { MealsConvexProvider } from '@/integrations/convex/provider';

const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
// eslint-disable-next-line turbo/no-undeclared-env-vars
const APP_BASE_URL = getMealsBaseUrl(import.meta.env.DEV);
// eslint-disable-next-line turbo/no-undeclared-env-vars
const IS_PROD = import.meta.env.PROD;
// eslint-disable-next-line turbo/no-undeclared-env-vars
const IS_DEV = import.meta.env.DEV;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#2d2d2d' },
      { title: 'Meals' }
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: `${APP_BASE_URL}manifest.webmanifest` }
    ]
  }),
  shellComponent: RootDocument
});

function RootDocument() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthGate publishableKey={CLERK_KEY}>
          <MealsConvexProvider>
            <AppFrame appId="meals" title="Meals" isDev={IS_DEV}>
              <Outlet />
            </AppFrame>
          </MealsConvexProvider>
        </AuthGate>
        <PwaUpdater swUrl={`${APP_BASE_URL}sw.js`} scope={APP_BASE_URL} enabled={IS_PROD} autoReload />
        <Scripts />
      </body>
    </html>
  );
}
