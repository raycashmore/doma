import { useRef } from 'react';
import { ClerkProvider, SignIn, SignedIn, SignedOut, useClerk } from '@clerk/clerk-react';
import { SignInLayout, UrlAuthProvider, createClerkSignInAppearance } from '@repo/shell';
import type { ReactNode } from 'react';

import { getBudgetBaseUrl } from '@/config/basePath';

export type AuthGateProps = {
  publishableKey: string | undefined;
  children: ReactNode;
};

// eslint-disable-next-line turbo/no-undeclared-env-vars
const AUTH_LOGO_URL = `${getBudgetBaseUrl(import.meta.env.DEV)}icons/icon.svg`;

function ClerkUrlAuth({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  return <UrlAuthProvider buildUrlWithAuth={(url) => clerk.buildUrlWithAuth(url)}>{children}</UrlAuthProvider>;
}

export function AuthGate({ publishableKey, children }: AuthGateProps) {
  const warned = useRef(false);

  if (!publishableKey) {
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
        <SignInLayout title="Sign in to Budget">
          <div className="relative w-full max-w-[25rem]">
            <img
              className="pointer-events-none absolute left-1/2 top-8 z-10 size-36 -translate-x-1/2"
              src={AUTH_LOGO_URL}
              alt="Budget"
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
