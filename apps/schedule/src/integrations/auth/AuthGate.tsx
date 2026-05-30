'use client';

import { type ReactNode } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  useClerk
} from '@clerk/nextjs';
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

export function AuthGate({ publishableKey, children }: AuthGateProps) {
  if (!publishableKey) {
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SignedIn>
        <ClerkUrlAuth>{children}</ClerkUrlAuth>
      </SignedIn>
      <SignedOut>
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
      </SignedOut>
    </ClerkProvider>
  );
}
