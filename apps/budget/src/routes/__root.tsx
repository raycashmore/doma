import {
  HeadContent,
  Scripts,
  createRootRoute,
  Outlet
} from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';

import ConvexProvider from '../integrations/convex/provider';
import { AppFrame, AuthGate } from '@repo/shell';

import appCss from '../styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Doma · Budget' }
    ],
    links: [{ rel: 'stylesheet', href: appCss }]
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
        <AuthGate>
          <ConvexProvider>
            <AppFrame appId="budget" title="Budget">
              <Outlet />
            </AppFrame>
            <TanStackDevtools
              config={{ position: 'bottom-right' }}
              plugins={[
                {
                  name: 'Tanstack Router',
                  render: <TanStackRouterDevtoolsPanel />
                }
              ]}
            />
          </ConvexProvider>
        </AuthGate>
        <Scripts />
      </body>
    </html>
  );
}
