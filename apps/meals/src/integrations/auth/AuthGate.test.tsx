import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthGate } from './AuthGate';
import type { ReactNode } from 'react';

let signedIn = true;
const signInSpy = vi.fn<(props: Record<string, unknown>) => ReactNode>((props) => (
  <div data-testid="sign-in" data-props={JSON.stringify(props)}>
    sign-in
  </div>
));

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: ReactNode }) => (signedIn ? <>{children}</> : null),
  SignedOut: ({ children }: { children: ReactNode }) => (signedIn ? null : <>{children}</>),
  SignIn: (props: Record<string, unknown>) => signInSpy(props),
  useClerk: () => ({ buildUrlWithAuth: (url: string) => url })
}));

afterEach(cleanup);

describe('AuthGate', () => {
  beforeEach(() => {
    signedIn = true;
    signInSpy.mockClear();
  });

  it('allows an auth bypass only in explicit fixture mode', () => {
    render(
      <AuthGate publishableKey={undefined} fixtureMode>
        <div>Fixture cookbook</div>
      </AuthGate>
    );

    expect(screen.getByText('Fixture cookbook')).toBeDefined();
  });

  it('fails closed when Clerk is missing outside fixture mode', () => {
    render(
      <AuthGate publishableKey={undefined} fixtureMode={false}>
        <div>Private cookbook</div>
      </AuthGate>
    );

    expect(screen.queryByText('Private cookbook')).toBeNull();
    expect(screen.getByRole('alert').textContent).toContain('Meals is not configured');
  });

  it('renders zone-safe large branding with a sign-in heading', () => {
    signedIn = false;

    render(
      <AuthGate publishableKey="pk_test_example">
        <div>Private cookbook</div>
      </AuthGate>
    );

    expect(screen.getByRole('heading', { name: 'Sign in to Meals' })).toBeDefined();
    const logo = screen.getByRole('img', { name: 'Meals' });
    expect(logo.getAttribute('src')).toBe('/icons/icon.svg');
    expect(logo.className).toContain('left-1/2');
    expect(logo.className).toContain('-translate-x-1/2');
    expect(logo.parentElement?.className).toContain('max-w-[25rem]');
    expect(signInSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        appearance: expect.objectContaining({
          elements: expect.objectContaining({
            card: {
              paddingTop: '12rem'
            }
          })
        })
      })
    );
  });
});
