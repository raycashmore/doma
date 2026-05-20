import { type ReactNode, useRef, createContext, useContext } from 'react';
import {
  ClerkProvider,
  SignedIn,
  SignedOut,
  SignIn,
  useClerk
} from '@clerk/clerk-react';

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

/**
 * Builder that appends Clerk's dev session token to a cross-origin URL so the
 * destination port auto-rehydrates the session. Identity for production /
 * same-origin URLs. Provided via context by AuthGate when Clerk is loaded;
 * `null` when AuthGate is a passthrough.
 */
type UrlAuthBuilder = (url: string) => string;
const UrlAuthContext = createContext<UrlAuthBuilder | null>(null);

export function useUrlAuth(): UrlAuthBuilder | null {
  return useContext(UrlAuthContext);
}

function ClerkUrlAuthProvider({ children }: { children: ReactNode }) {
  const clerk = useClerk();
  return (
    <UrlAuthContext.Provider value={(url) => clerk.buildUrlWithAuth(url)}>
      {children}
    </UrlAuthContext.Provider>
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
        <ClerkUrlAuthProvider>{children}</ClerkUrlAuthProvider>
      </SignedIn>
      <SignedOut>
        <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
          <div className="flex w-full max-w-md flex-col gap-3 text-center">
            <p className="text-sm font-medium uppercase tracking-[0.24em] text-neutral-500">
              Private access
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
              Sign in to Doma
            </h1>
            <p className="text-sm text-neutral-600">
              Access is limited to approved family accounts.
            </p>
            <div className="flex justify-center">
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
              />
            </div>
          </div>
        </div>
      </SignedOut>
    </ClerkProvider>
  );
}
