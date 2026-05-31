import { type ReactNode, useRef } from 'react';
import {
  ClerkProvider,
  SignIn,
  SignedIn,
  SignedOut,
  useClerk
} from '@clerk/clerk-react';
import { SignInLayout, UrlAuthProvider } from '@repo/shell';

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
            signUpUrl=""
            transferable={false}
            withSignUp={false}
          />
        </SignInLayout>
      </SignedOut>
    </ClerkProvider>
  );
}
