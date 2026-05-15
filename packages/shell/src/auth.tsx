import { type ReactNode, useRef } from 'react';
import { ClerkProvider, SignedIn, SignedOut, SignIn } from '@clerk/clerk-react';

export interface AuthGateProps {
  /**
   * Clerk publishable key. When undefined or empty, AuthGate is a passthrough
   * and the app boots without sign-in (useful during initial scaffold).
   * Once Clerk is set up per docs/auth.md, the key becomes a string and the
   * gate activates.
   */
  publishableKey: string | undefined;
  children: ReactNode;
}

export function AuthGate({ publishableKey, children }: AuthGateProps) {
  const warned = useRef(false);

  if (!publishableKey) {
    if (typeof window !== 'undefined' && !warned.current) {
       
      console.warn(
        '[doma] AuthGate is bypassed: VITE_CLERK_PUBLISHABLE_KEY is not set. ' +
          'See docs/auth.md to enable sign-in.'
      );
      warned.current = true;
    }
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SignedIn>{children}</SignedIn>
      <SignedOut>
        <div className="flex items-center justify-center min-h-screen bg-neutral-50">
          <SignIn routing="hash" />
        </div>
      </SignedOut>
    </ClerkProvider>
  );
}
