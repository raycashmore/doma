import type { ReactNode } from 'react';

export interface AuthGateProps {
  children: ReactNode;
}

// Phase 6 replaces the body of this component to use Clerk's <SignedIn> /
// <SignedOut>. Until then it's a passthrough so the app boots while we
// scaffold the rest of the multi-zones plumbing.
export function AuthGate({ children }: AuthGateProps) {
  return <>{children}</>;
}
