import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';

import AppShell from './AppShell.vue';

describe('AppShell', () => {
  afterEach(cleanup);

  it('renders every enabled Doma zone and the current Home content', () => {
    render(AppShell, {
      props: { isDev: false, canSignOut: false, buildUrlWithAuth: (url: string) => url },
      slots: { default: '<main><h2>Household overview</h2></main>' }
    });

    for (const label of ['Home', 'Budget', 'Schedule', 'Lists', 'Meals']) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole('link', { name: 'Mortgage' })).toBeNull();
    for (const homeLink of screen.getAllByRole('link', { name: 'Home' })) {
      expect(homeLink.getAttribute('aria-current')).toBe('page');
    }
    expect(screen.getByRole('heading', { name: 'Household overview' })).not.toBeNull();
  });

  it('exposes notification settings and sign out when authenticated', async () => {
    const { emitted } = render(AppShell, {
      props: { isDev: false, canSignOut: true, buildUrlWithAuth: (url: string) => url }
    });

    expect(screen.getAllByRole('link', { name: 'Notification settings' })[0]?.getAttribute('href')).toBe(
      '/settings/notifications'
    );
    await screen.getAllByRole('button', { name: 'Sign out' })[0]?.click();
    expect(emitted()).toHaveProperty('signOut');
  });

  it('adds Clerk handoff tokens to local cross-zone links', () => {
    render(AppShell, {
      props: {
        isDev: true,
        canSignOut: false,
        buildUrlWithAuth: (url: string) => `${url}?__clerk_db_jwt=dev-token`
      }
    });

    for (const budgetLink of screen.getAllByRole('link', { name: 'Budget' })) {
      expect(budgetLink.getAttribute('href')).toBe('http://localhost:3001/?__clerk_db_jwt=dev-token');
    }
  });
});
