import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { AppFrame } from '@repo/shell';
import { AuthGate } from '@/integrations/auth/AuthGate';
import AppConvexProvider from '@/integrations/convex/provider';
import { dmSans, dmSerifDisplay } from './fonts';
import './globals.css';

const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const IS_DEV = process.env.NODE_ENV !== 'production';

export const metadata: Metadata = {
  title: 'Doma · Schedule',
  appleWebApp: { capable: true, title: 'Schedule', statusBarStyle: 'default' }
};

export const viewport: Viewport = {
  themeColor: '#f97316',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${dmSerifDisplay.variable}`}>
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
