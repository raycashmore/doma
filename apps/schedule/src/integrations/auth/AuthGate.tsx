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
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkAuthenticatedGate>{children}</ClerkAuthenticatedGate>
    </ClerkProvider>
  );
}
