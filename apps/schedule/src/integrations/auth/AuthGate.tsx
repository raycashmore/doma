'use client';

import { ClerkProvider, SignIn, useAuth, useClerk } from '@clerk/nextjs';
import { SignInLayout, UrlAuthProvider } from '@repo/shell';
import { type ReactNode } from 'react';

import { getScheduleAssetUrl } from '@/config/basePath';

export type AuthGateProps = {
  publishableKey: string | undefined;
  children: ReactNode;
};

const IS_DEV = process.env.NODE_ENV !== 'production';
const AUTH_LOGO_URL = getScheduleAssetUrl(IS_DEV, 'icons/icon.svg');

function ClerkUrlAuth({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  return <UrlAuthProvider buildUrlWithAuth={(url) => clerk.buildUrlWithAuth(url)}>{children}</UrlAuthProvider>;
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
    <SignInLayout title="Sign in to Schedule">
      <div className="relative w-full max-w-[25rem]">
        {/* This branded SVG must bypass image optimization so its base-path URL stays exact. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="pointer-events-none absolute left-1/2 top-8 z-10 size-36 -translate-x-1/2"
          src={AUTH_LOGO_URL}
          alt="Schedule"
        />
        <SignIn
          appearance={{
            elements: {
              card: {
                paddingTop: '12rem'
              },
              footerAction: 'hidden',
              footerActionLink: 'hidden',
              headerSubtitle: 'hidden',
              headerTitle: 'hidden'
            }
          }}
          fallbackRedirectUrl="/"
          routing="hash"
          withSignUp={false}
        />
      </div>
    </SignInLayout>
  );
}

export function AuthGate({ publishableKey, children }: AuthGateProps) {
  if (!publishableKey) {
    if (process.env.NODE_ENV !== 'test') {
      console.warn('[doma] AuthGate bypassed: NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set.');
    }
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <ClerkAuthenticatedGate>{children}</ClerkAuthenticatedGate>
    </ClerkProvider>
  );
}
