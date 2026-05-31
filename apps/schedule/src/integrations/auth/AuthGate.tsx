'use client';

import { type ReactNode } from 'react';
import { ClerkProvider, SignIn, useAuth, useClerk } from '@clerk/nextjs';
import { UrlAuthProvider, SignInLayout } from '@repo/shell';

export type AuthGateProps = {
  publishableKey: string | undefined;
  children: ReactNode;
};

function ClerkUrlAuth({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  return (
    <UrlAuthProvider buildUrlWithAuth={(url) => clerk.buildUrlWithAuth(url)}>
      {children}
    </UrlAuthProvider>
  );
}

// Clerk v7's `@clerk/nextjs` dropped the client `<SignedIn>`/`<SignedOut>`
// components (they're server-only now), so we gate on `useAuth()` instead of
// the `<SignedIn>`/`<SignedOut>` pattern used by Budget/Home's clerk-react
// adapters. `<SignIn>` here also omits `signUpUrl`/`transferable` for the same
// reason — those props aren't part of the nextjs `<SignIn>` surface.
function ClerkAuthenticatedGate({ children }: { children: ReactNode }) {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded) {
    return null;
  }

  if (isSignedIn) {
    return <ClerkUrlAuth>{children}</ClerkUrlAuth>;
  }

  return (
    <SignInLayout>
      <SignIn
        appearance={{
          elements: {
            footerAction: 'hidden',
            footerActionLink: 'hidden'
          }
        }}
        fallbackRedirectUrl="/"
        routing="hash"
        withSignUp={false}
      />
    </SignInLayout>
  );
}

export function AuthGate({ publishableKey, children }: AuthGateProps) {
  if (!publishableKey) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn(
        '[doma] AuthGate bypassed: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set.'
      );
    }
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkAuthenticatedGate>{children}</ClerkAuthenticatedGate>
    </ClerkProvider>
  );
}
