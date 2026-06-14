export type ClerkSession = {
  userName: string;
  signOut: () => Promise<void>;
};

export type ClerkAuthState =
  | { status: 'loading' }
  | { status: 'ready'; session: ClerkSession | null }
  | { status: 'disabled' }
  | { status: 'error'; message: string };

export async function loadClerkSession(
  publishableKey: string | undefined,
  signInElement: HTMLDivElement
): Promise<ClerkAuthState> {
  if (!publishableKey) {
    console.warn('Lists AuthGate running without VITE_CLERK_PUBLISHABLE_KEY; auth is disabled for this process.');
    return { status: 'disabled' };
  }

  const { Clerk } = await import('@clerk/clerk-js');
  const clerk = new Clerk(publishableKey);
  await clerk.load();

  if (!clerk.user) {
    clerk.mountSignIn(signInElement);
    return { status: 'ready', session: null };
  }

  return {
    status: 'ready',
    session: {
      userName: clerk.user.fullName ?? clerk.user.primaryEmailAddress?.emailAddress ?? 'Household user',
      signOut: async () => {
        await clerk.signOut();
      }
    }
  };
}
