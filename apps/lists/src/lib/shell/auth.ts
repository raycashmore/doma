import type { Clerk } from '@clerk/clerk-js';
import { loadClerkJsScript, loadClerkUIScript } from '@clerk/shared/loadClerkJsScript';

export type ClerkSession = {
  userName: string;
  buildUrlWithAuth: (url: string) => string;
  getToken: (options: { template?: 'convex'; skipCache?: boolean }) => Promise<string | null>;
  signOut: () => Promise<void>;
};

export type ClerkAuthState =
  | { status: 'loading' }
  | { status: 'ready'; session: ClerkSession | null }
  | { status: 'disabled' }
  | { status: 'error'; message: string };

export function resolveAuthenticatedUrl(authState: ClerkAuthState, url: string): string {
  return authState.status === 'ready' && authState.session ? authState.session.buildUrlWithAuth(url) : url;
}

type ClerkBrowser = InstanceType<typeof Clerk>;
type ClerkUIConstructor = NonNullable<Parameters<ClerkBrowser['load']>[0]>['ui'] extends {
  ClerkUI?: infer T;
}
  ? Exclude<Awaited<T>, undefined>
  : never;
type ClerkWindow = Window & {
  Clerk?: ClerkBrowser;
  __internal_ClerkUICtor?: ClerkUIConstructor;
};

async function loadClerkBrowserScript(publishableKey: string): Promise<ClerkBrowser> {
  const clerkWindow = window as ClerkWindow;
  await Promise.all([
    clerkWindow.Clerk ? Promise.resolve() : loadClerkJsScript({ publishableKey }),
    clerkWindow.__internal_ClerkUICtor ? Promise.resolve() : loadClerkUIScript({ publishableKey })
  ]);

  if (!clerkWindow.Clerk) throw new Error('Unable to load Lists sign-in.');
  if (!clerkWindow.__internal_ClerkUICtor) throw new Error('Unable to load Lists sign-in.');
  return clerkWindow.Clerk;
}

export async function loadClerkSession(
  publishableKey: string | undefined,
  signInElement: HTMLDivElement
): Promise<ClerkAuthState> {
  if (!publishableKey) {
    console.warn('Lists AuthGate running without VITE_CLERK_PUBLISHABLE_KEY; auth is disabled for this process.');
    return { status: 'disabled' };
  }

  const clerk = await loadClerkBrowserScript(publishableKey);
  await clerk.load({ ui: { ClerkUI: (window as ClerkWindow).__internal_ClerkUICtor } });

  if (!clerk.user || !clerk.session) {
    clerk.mountSignIn(signInElement, {
      forceRedirectUrl: '/lists',
      appearance: {
        elements: {
          card: {
            paddingTop: '12rem'
          },
          headerSubtitle: 'hidden',
          headerTitle: 'hidden'
        }
      }
    });
    return { status: 'ready', session: null };
  }

  const session = clerk.session;

  return {
    status: 'ready',
    session: {
      userName: clerk.user.fullName ?? clerk.user.primaryEmailAddress?.emailAddress ?? 'Household user',
      buildUrlWithAuth: (url) => clerk.buildUrlWithAuth(url),
      getToken: (options) => session.getToken(options),
      signOut: async () => {
        await clerk.signOut();
      }
    }
  };
}
