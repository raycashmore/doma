import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/clerk-react';
import type { ReactNode } from 'react';

import { ConfigurationError } from '@/integrations/auth/AuthGate';
import { CLERK_KEY, CONVEX_URL } from '@/config/runtime';

const convex = CONVEX_URL ? new ConvexReactClient(CONVEX_URL) : null;

export function MealsConvexProvider({ children }: { children: ReactNode }) {
  if (!convex) return <ConfigurationError message="VITE_CONVEX_URL is required." />;

  if (CLERK_KEY) {
    return (
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
