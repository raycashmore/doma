import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/clerk-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env = (import.meta as any).env;
const CONVEX_URL = env.VITE_CONVEX_URL;
const CLERK_KEY = env.VITE_CLERK_PUBLISHABLE_KEY;

if (!CONVEX_URL) {
  // eslint-disable-next-line no-console
  console.error('missing envar VITE_CONVEX_URL');
}

const convex = new ConvexReactClient(CONVEX_URL);

export default function AppConvexProvider({
  children
}: {
  children: React.ReactNode;
}) {
  // When Clerk isn't configured yet, fall back to a plain ConvexProvider so
  // the app still boots during scaffold/dev. Once VITE_CLERK_PUBLISHABLE_KEY
  // is set, the ConvexProviderWithClerk path takes over and Convex queries
  // are authenticated with the Clerk JWT.
  if (CLERK_KEY) {
    return (
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    );
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
