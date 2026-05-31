import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { AuthGate } from './AuthGate';

type AuthState = { isLoaded: boolean; isSignedIn: boolean };

// Mutable so each test can drive the `useAuth()` gate through its states.
let authState: AuthState = { isLoaded: true, isSignedIn: false };

const signInSpy = vi.fn<(props: Record<string, unknown>) => ReactNode>(
  (props) => (
    <div data-testid="sign-in" data-props={JSON.stringify(props)}>
      sign-in
    </div>
  )
);

vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignIn: (props: Record<string, unknown>) => signInSpy(props),
  useAuth: () => authState,
  useClerk: () => ({
    buildUrlWithAuth: (url: string) => `${url}?token=dev`
  })
}));

describe('AuthGate', () => {
  beforeEach(() => {
    signInSpy.mockClear();
    authState = { isLoaded: true, isSignedIn: false };
  });
  afterEach(cleanup);

  it('passes children through when the publishable key is missing', () => {
    render(
      <AuthGate publishableKey={undefined}>
        <div>Schedule page</div>
      </AuthGate>
    );

    expect(screen.getByText('Schedule page')).toBeDefined();
    expect(screen.queryByTestId('sign-in')).toBeNull();
  });

  it('renders nothing while Clerk is still loading', () => {
    authState = { isLoaded: false, isSignedIn: false };

    const { container } = render(
      <AuthGate publishableKey="pk_test_example">
        <div>App content</div>
      </AuthGate>
    );

    expect(screen.queryByText('App content')).toBeNull();
    expect(screen.queryByTestId('sign-in')).toBeNull();
    expect(container.innerHTML).toBe('');
  });

  it('renders the app once loaded and signed in', () => {
    authState = { isLoaded: true, isSignedIn: true };

    render(
      <AuthGate publishableKey="pk_test_example">
        <div>App content</div>
      </AuthGate>
    );

    expect(screen.getByText('App content')).toBeDefined();
    expect(screen.queryByTestId('sign-in')).toBeNull();
  });

  it('renders a sign-in only experience once loaded and signed out', () => {
    authState = { isLoaded: true, isSignedIn: false };

    render(
      <AuthGate publishableKey="pk_test_example">
        <div>Hidden app content</div>
      </AuthGate>
    );

    expect(screen.getByTestId('sign-in')).toBeDefined();
    expect(screen.queryByText('Hidden app content')).toBeNull();

    expect(signInSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        routing: 'hash',
        withSignUp: false,
        fallbackRedirectUrl: '/',
        appearance: expect.objectContaining({
          elements: expect.objectContaining({
            footerAction: 'hidden',
            footerActionLink: 'hidden'
          })
        })
      })
    );
  });
});
