'use client';

import { type ReactNode, createContext, useContext } from 'react';

/**
 * Builder that appends a cross-origin auth token to a URL so the destination
 * port auto-rehydrates the session. Identity for production / same-origin
 * URLs. Each app supplies one via `UrlAuthProvider` using its own Clerk SDK;
 * `null` when auth is not configured (passthrough).
 */
type UrlAuthBuilder = (url: string) => string;

const UrlAuthContext = createContext<UrlAuthBuilder | null>(null);

export function useUrlAuth(): UrlAuthBuilder | null {
  return useContext(UrlAuthContext);
}

export function UrlAuthProvider({
  buildUrlWithAuth,
  children
}: {
  buildUrlWithAuth: UrlAuthBuilder;
  children: ReactNode;
}) {
  return (
    <UrlAuthContext.Provider value={buildUrlWithAuth}>
      {children}
    </UrlAuthContext.Provider>
  );
}

/**
 * Presentational wrapper for a signed-out screen. The app drops its own
 * SDK-specific `<SignIn>` inside. Framework-neutral — no Clerk import.
 */
export function SignInLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-6">
      <div className="flex w-full max-w-md flex-col gap-3 text-center">
        <div className="flex justify-center">{children}</div>
      </div>
    </div>
  );
}
