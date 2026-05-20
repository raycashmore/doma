import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { AuthGate } from './auth';

const signInSpy = vi.fn<(props: Record<string, unknown>) => ReactNode>(
  (props) => (
    <div data-testid="sign-in" data-props={JSON.stringify(props)}>
      sign-in
    </div>
  )
);

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
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

    expect(signInSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        routing: 'hash',
        signUpUrl: '',
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
