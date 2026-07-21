import { cleanup, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

vi.mock('@clerk/vue', () => ({
  SignIn: { template: '<div data-testid="sign-in" />' },
  useAuth: () => ({ isLoaded: { value: true }, isSignedIn: { value: false } }),
  useClerk: () => ({ value: undefined })
}));

vi.mock('@/integrations/convex/useConvexAuthBridge', () => ({
  useConvexAuthBridge: vi.fn()
}));

import AuthenticatedGate from './AuthenticatedGate.vue';

afterEach(cleanup);

describe('AuthenticatedGate', () => {
  it('returns to Home from the signed-out brand without reloading the document', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<main />' } },
        { path: '/signed-out', component: { template: '<main />' } }
      ]
    });
    await router.push('/signed-out');

    render(AuthenticatedGate, { global: { plugins: [router] } });
    await screen.getByRole('link', { name: 'Doma Home' }).click();

    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/'));
  });
});
