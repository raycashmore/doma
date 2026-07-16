import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/clerk-react';
import type { ReactNode } from 'react';

const CONVEX_URL = import.meta.env.VITE_CONVEX_URL;
const CLERK_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CONVEX_URL) {
  console.error('missing envar VITE_CONVEX_URL');
}

const convex = new ConvexReactClient(CONVEX_URL);

export function MealsConvexProvider({ children }: { children: ReactNode }) {
  if (CLERK_KEY) {
    return (
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    );
  }

  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
