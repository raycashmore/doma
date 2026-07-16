import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AuthGate } from './AuthGate';
import type { ReactNode } from 'react';

vi.mock('@clerk/clerk-react', () => ({
  ClerkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignedIn: ({ children }: { children: ReactNode }) => <>{children}</>,
  SignedOut: () => null,
  SignIn: () => null,
  useClerk: () => ({ buildUrlWithAuth: (url: string) => url })
}));

afterEach(cleanup);

describe('AuthGate', () => {
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
});
