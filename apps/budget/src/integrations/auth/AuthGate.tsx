import { useRef } from 'react';
import { ClerkProvider, SignIn, SignedIn, SignedOut, useClerk } from '@clerk/clerk-react';
import { SignInLayout, UrlAuthProvider } from '@repo/shell';
import { getBudgetBaseUrl } from '@/config/basePath';
import type { ReactNode } from 'react';

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
          <SignIn
            appearance={{
              layout: {
                logoImageUrl: AUTH_LOGO_URL
              },
              elements: {
                footerAction: 'hidden',
                footerActionLink: 'hidden',
                headerSubtitle: 'hidden',
                headerTitle: 'hidden',
                logoBox: {
                  height: '9rem',
                  width: '9rem'
                },
                logoImage: {
                  height: '9rem',
                  width: '9rem'
                }
              }
            }}
            fallbackRedirectUrl="/"
            routing="hash"
            signUpUrl=""
            transferable={false}
            withSignUp={false}
          />
        </SignInLayout>
      </SignedOut>
    </ClerkProvider>
  );
}
