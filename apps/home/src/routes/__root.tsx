import { HeadContent, Outlet, Scripts, createRootRoute } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';
import { TanStackDevtools } from '@tanstack/react-devtools';

import { AppFrame } from '@repo/shell';
import appCss from '../styles.css?url';
import { AuthGate } from '@/integrations/auth/AuthGate';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const CLERK_KEY = (import.meta as any).env.VITE_CLERK_PUBLISHABLE_KEY;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_PROD = Boolean((import.meta as any).env.PROD);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IS_DEV = Boolean((import.meta as any).env.DEV);
const SERVICE_WORKER_SCRIPT = `if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' });
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
      { name: 'apple-mobile-web-app-title', content: 'Doma' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
      { title: 'Doma' }
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      {
        rel: 'icon',
        type: 'image/svg+xml',
        href: '/icons/icon.svg'
      },
      {
        rel: 'apple-touch-icon',
        sizes: '180x180',
        href: '/icons/apple-touch-icon.png'
      }
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
          <AppFrame appId="home" title="" isDev={IS_DEV}>
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
        </AuthGate>
        {IS_PROD ? <script dangerouslySetInnerHTML={{ __html: SERVICE_WORKER_SCRIPT }} /> : null}
        <Scripts />
      </body>
    </html>
  );
}
