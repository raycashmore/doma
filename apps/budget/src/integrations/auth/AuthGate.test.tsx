import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthGate } from './AuthGate';
import type { ReactNode } from 'react';

const signInSpy = vi.fn<(props: Record<string, unknown>) => ReactNode>((props) => (
  <div data-testid="sign-in" data-props={JSON.stringify(props)}>
    sign-in
  </div>
));

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  // SignedIn renders null here: these tests only exercise the signed-out / passthrough paths.
  SignedIn: () => null,
  SignedOut: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignIn: (props: Record<string, unknown>) => signInSpy(props),
  useClerk: () => ({
    buildUrlWithAuth: (url: string) => `${url}?token=dev`
  })
}));

describe('AuthGate', () => {
  beforeEach(() => {
    signInSpy.mockClear();
  });

  it('passes children through when the publishable key is missing', () => {
    render(
      <AuthGate publishableKey={undefined}>
        <div>Budget page</div>
      </AuthGate>
    );

    expect(screen.getByText('Budget page')).toBeDefined();
    expect(screen.queryByTestId('sign-in')).toBeNull();
  });

  it('renders a sign-in only experience when the publishable key is set', () => {
    render(
      <AuthGate publishableKey="pk_test_example">
        <div>Hidden app content</div>
      </AuthGate>
    );

    const signIn = screen.getByTestId('sign-in');
    expect(signIn).toBeDefined();
    expect(screen.queryByText('Hidden app content')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Sign in to Budget' })).toBeDefined();

    expect(signInSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        routing: 'hash',
        signUpUrl: '',
        transferable: false,
        withSignUp: false,
        fallbackRedirectUrl: '/',
        appearance: expect.objectContaining({
          layout: {
            logoImageUrl: '/icons/icon.svg'
          },
          elements: expect.objectContaining({
            footerAction: 'hidden',
            footerActionLink: 'hidden',
            logoBox: {
              height: '9rem',
              width: '9rem'
            },
            logoImage: {
              height: '9rem',
              width: '9rem'
            }
          })
        })
      })
    );
  });
});
