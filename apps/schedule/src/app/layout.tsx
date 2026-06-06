import './globals.css';

import { AppFrame } from '@repo/shell';
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { AuthGate } from '@/integrations/auth/AuthGate';
import AppConvexProvider from '@/integrations/convex/provider';

import { dmSans, merriweather } from './fonts';

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const IS_DEV = process.env.NODE_ENV !== 'production';

export const metadata: Metadata = {
  applicationName: 'Schedule',
  title: 'Schedule',
  description: 'Family schedule',
  appleWebApp: { capable: true, title: 'Schedule', statusBarStyle: 'default' },
  formatDetection: { telephone: false },
  icons: [
    { rel: 'icon', url: '/favicon.png' },
    { rel: 'apple-touch-icon', url: '/icons/apple-touch-icon.png', sizes: '180x180' }
  ]
};

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${merriweather.variable}`}>
      <body>
        <AuthGate publishableKey={CLERK_KEY}>
          <AppConvexProvider>
            <AppFrame appId="schedule" title="Schedule" isDev={IS_DEV}>
              {children}
            </AppFrame>
          </AppConvexProvider>
        </AuthGate>
      </body>
    </html>
  );
}
