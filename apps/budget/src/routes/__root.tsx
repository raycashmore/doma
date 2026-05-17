import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute
} from '@tanstack/react-router';
import { useState } from 'react';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';

import { AppFrame, AuthGate } from '@repo/shell';
import ConvexProvider from '../integrations/convex/provider';
import appCss from '../styles.css?url';
import type { ReactNode } from 'react';
import { BudgetHeaderActionsProvider } from '@/components/budget/BudgetHeaderActionsContext';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CLERK_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;

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
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <AuthGate publishableKey={CLERK_KEY}>
          <ConvexProvider>
            <BudgetHeaderActionsProvider setActions={setHeaderActions}>
              <AppFrame
                appId="budget"
                title="Budget"
                actions={headerActions}
                headerClassName="px-4 pt-2 pb-3"
                mainClassName="px-4 pb-4"
              >
                <Outlet />
              </AppFrame>
            </BudgetHeaderActionsProvider>
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
