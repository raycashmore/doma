import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { AppFrame, PwaUpdater } from '@repo/shell';

import appCss from '../styles.css?url';
import { AuthGate, ConfigurationError } from '@/integrations/auth/AuthGate';
import { getMealsBaseUrl } from '@/config/basePath';
import { CLERK_KEY, FIXTURE_MODE, MEALS_RUNTIME } from '@/config/runtime';
import { MealsConvexProvider } from '@/integrations/convex/provider';

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
  const app = (
    <AppFrame appId="meals" title="Meals" isDev={IS_DEV} mainClassName="md:pb-7 md:pr-7 md:pl-2">
      {MEALS_RUNTIME.mode === 'misconfigured' ? <ConfigurationError message={MEALS_RUNTIME.message} /> : <Outlet />}
    </AppFrame>
  );

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthGate publishableKey={CLERK_KEY} fixtureMode={FIXTURE_MODE}>
          {MEALS_RUNTIME.mode === 'misconfigured' ? app : <MealsConvexProvider>{app}</MealsConvexProvider>}
        </AuthGate>
        <PwaUpdater swUrl={`${APP_BASE_URL}sw.js`} scope={APP_BASE_URL} enabled={IS_PROD} autoReload />
        <Scripts />
      </body>
    </html>
  );
}
