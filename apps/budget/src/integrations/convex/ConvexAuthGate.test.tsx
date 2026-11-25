import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConvexAuthGate } from './ConvexAuthGate';

const auth = vi.hoisted(() => ({ isLoading: true, isAuthenticated: false, hasProvider: true }));

vi.mock('convex/react', () => ({
  useConvexAuth: () => {
    // Like the real hook, it throws outside a Convex auth provider, which fixture mode does not mount.
    if (!auth.hasProvider) throw new Error('No Convex auth provider');
    return auth;
  }
}));

afterEach(() => {
  auth.hasProvider = true;
});

afterEach(cleanup);

function renderGate(required: boolean) {
  render(
    <ConvexAuthGate required={required}>
      <div>Budget overview</div>
    </ConvexAuthGate>
  );
}

describe('ConvexAuthGate', () => {
  it('holds the page back until Convex has the sign-in token', () => {
    Object.assign(auth, { isLoading: true, isAuthenticated: false });
    renderGate(true);
    expect(screen.queryByText('Budget overview')).toBeNull();
  });

  it('shows the page once Convex accepts the token', () => {
    Object.assign(auth, { isLoading: false, isAuthenticated: true });
    renderGate(true);
    expect(screen.getByText('Budget overview')).toBeTruthy();
  });

  it('explains the problem when Convex rejects the token', () => {
    Object.assign(auth, { isLoading: false, isAuthenticated: false });
    renderGate(true);
    expect(screen.getByRole('alert').textContent).toContain('Sign out and sign in again');
    expect(screen.queryByText('Budget overview')).toBeNull();
  });

  it('shows the page straight away in fixture mode, without reading Convex auth', () => {
    Object.assign(auth, { isLoading: true, isAuthenticated: false, hasProvider: false });
    renderGate(false);
    expect(screen.getByText('Budget overview')).toBeTruthy();
  });
});
