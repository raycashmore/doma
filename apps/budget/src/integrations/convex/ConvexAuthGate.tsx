import { useConvexAuth } from 'convex/react';
import type { ReactNode } from 'react';

type ConvexAuthGateProps = {
  // False in no-auth fixture mode, where nothing reads Convex.
  required: boolean;
  children: ReactNode;
};

// Finance queries reject a caller without a Convex token, so the page waits for one. The app frame
// stays outside this gate, so sign-out remains reachable if Convex never accepts the Clerk token.
export function ConvexAuthGate({ required, children }: ConvexAuthGateProps) {
  // Fixture mode has no Convex auth provider, so the auth hook must not run there.
  if (!required) return <>{children}</>;
  return <SignedInGate>{children}</SignedInGate>;
}

function SignedInGate({ children }: { children: ReactNode }) {
  const { isLoading, isAuthenticated } = useConvexAuth();

  if (isAuthenticated) return <>{children}</>;
  if (isLoading) return <p className="sr-only">Loading budget</p>;
  return (
    <p role="alert" className="p-6 text-sm">
      Budget couldn&apos;t confirm your sign-in. Sign out and sign in again.
    </p>
  );
}
