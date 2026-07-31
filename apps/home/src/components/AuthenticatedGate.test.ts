import { render, screen } from '@testing-library/vue';
import { describe, expect, it, vi } from 'vitest';

import AuthenticatedGate from './AuthenticatedGate.vue';

vi.mock('@clerk/vue', () => ({
  SignIn: {
    template: '<div>Continue with Google</div>'
  },
  useAuth: () => ({
    isLoaded: { value: true },
    isSignedIn: { value: false }
  }),
  useClerk: () => ({
    value: {
      buildUrlWithAuth: (url: string) => url
    }
  })
}));

vi.mock('../integrations/convex/useConvexAuthBridge', () => ({
  useConvexAuthBridge: vi.fn()
}));

describe('AuthenticatedGate', () => {
  it('gives the Noticeboard sign-in screen an accessible heading', () => {
    render(AuthenticatedGate);

    expect(screen.getByRole('heading', { name: 'Sign in to Noticeboard' })).not.toBeNull();
  });
});
