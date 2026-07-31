import { useRef } from 'react';
import { ClerkProvider, SignIn, SignedIn, SignedOut, useClerk } from '@clerk/clerk-react';
import { SignInLayout, UrlAuthProvider, createClerkSignInAppearance } from '@repo/shell';
import type { ReactNode } from 'react';

import { getMealsBaseUrl } from '@/config/basePath';

export type AuthGateProps = {
  publishableKey: string | undefined;
  fixtureMode?: boolean;
  children: ReactNode;
};

// eslint-disable-next-line turbo/no-undeclared-env-vars
const AUTH_LOGO_URL = `${getMealsBaseUrl(import.meta.env.DEV)}icons/icon.svg`;

function ClerkUrlAuth({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  return <UrlAuthProvider buildUrlWithAuth={(url) => clerk.buildUrlWithAuth(url)}>{children}</UrlAuthProvider>;
}

export function ConfigurationError({ message }: { message: string }) {
  return (
    <div
      role="alert"
      className="flex min-h-64 items-center justify-center rounded-[28px] bg-warm-bg-card p-8 text-center"
    >
      <div>
        <h1 className="font-warm-display text-2xl">Meals is not configured</h1>
        <p className="mt-2 text-sm text-warm-text-secondary">{message}</p>
      </div>
    </div>
  );
}

export function AuthGate({ publishableKey, fixtureMode = false, children }: AuthGateProps) {
  const warned = useRef(false);

  if (!publishableKey) {
    if (!fixtureMode) {
      return <ConfigurationError message="VITE_CLERK_PUBLISHABLE_KEY is required in production." />;
    }
    if (typeof window !== 'undefined' && !warned.current) {
      console.warn(
        '[doma] AuthGate is bypassed: VITE_CLERK_PUBLISHABLE_KEY is not set. ' + 'See docs/auth.md to enable sign-in.'
      );
      warned.current = true;
    }
    return <>{children}</>;
  }

  return (
    <ClerkProvider publishableKey={publishableKey}>
      <SignedIn>
        <ClerkUrlAuth>{children}</ClerkUrlAuth>
      </SignedIn>
      <SignedOut>
        <SignInLayout title="Sign in to Meals">
          <div className="relative w-full">
            <img
              className="pointer-events-none absolute left-1/2 top-8 z-10 size-36 -translate-x-1/2"
              src={AUTH_LOGO_URL}
              alt="Meals"
            />
            <SignIn
              appearance={createClerkSignInAppearance()}
              fallbackRedirectUrl="/"
              routing="hash"
              signUpUrl=""
              transferable={false}
              withSignUp={false}
            />
          </div>
        </SignInLayout>
      </SignedOut>
    </ClerkProvider>
  );
}
