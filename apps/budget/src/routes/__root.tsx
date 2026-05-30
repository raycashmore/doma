import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRoute
} from '@tanstack/react-router';
import { useState } from 'react';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';

import { AppFrame } from '@repo/shell';
import { AuthGate } from '@/integrations/auth/AuthGate';
import ConvexProvider from '../integrations/convex/provider';
import appCss from '../styles.css?url';
import type { ReactNode } from 'react';
import { BudgetHeaderActionsProvider } from '@/components/budget/BudgetHeaderActionsContext';
import { getBudgetBaseUrl } from '@/config/basePath';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CLERK_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const APP_BASE_URL = getBudgetBaseUrl((import.meta as any).env.DEV);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_PROD = Boolean((import.meta as any).env.PROD);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_DEV = Boolean((import.meta as any).env.DEV);
const SERVICE_WORKER_SCRIPT = `if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('${APP_BASE_URL}sw.js', { scope: '${APP_BASE_URL}' });
  });
}`;

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'theme-color', content: '#f97316' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-title', content: 'Budget' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { title: 'Doma · Budget' }
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: `${APP_BASE_URL}manifest.webmanifest` },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: `${APP_BASE_URL}icons/icon.svg`
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: `${APP_BASE_URL}icons/apple-touch-icon.png`
      }
    ]
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
                isDev={IS_DEV}
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
        {IS_PROD ? (
          <script dangerouslySetInnerHTML={{ __html: SERVICE_WORKER_SCRIPT }} />
        ) : null}
        <Scripts />
      </body>
    </html>
  );
}
