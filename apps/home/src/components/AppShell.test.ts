import type { RenderOptions } from '@testing-library/vue';
import { cleanup, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import AppShell from './AppShell.vue';

function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<main />' } },
      { path: '/settings/notifications', component: { template: '<main />' } }
    ]
  });
}

function renderAppShell(options: RenderOptions<typeof AppShell>, router = createTestRouter()) {
  return render(AppShell, {
    ...options,
    global: { ...options.global, plugins: [router] }
  });
}

describe('AppShell', () => {
  afterEach(cleanup);

  it('renders every enabled Doma zone and the current Home content', () => {
    const { container } = renderAppShell({
      props: { isDev: false, buildUrlWithAuth: (url: string) => url },
      slots: { default: '<main><h2>Household overview</h2></main>' }
    });

    for (const label of ['Home', 'Budget', 'Schedule', 'Lists', 'Meals']) {
      expect(screen.getAllByRole('link', { name: label }).length).toBeGreaterThan(0);
    }
    expect(screen.queryByRole('link', { name: 'Mortgage' })).toBeNull();
    for (const homeLink of screen.getAllByRole('link', { name: 'Home' })) {
      expect(homeLink.getAttribute('aria-current')).toBe('page');
    }
    expect(container.querySelector('.desktop-sidebar .lucide-house')).not.toBeNull();
    expect(container.querySelector('.desktop-sidebar .lucide-piggy-bank')).not.toBeNull();
    expect(container.querySelector('.desktop-sidebar .lucide-calendar')).not.toBeNull();
    expect(container.querySelector('.desktop-sidebar .lucide-list-checks')).not.toBeNull();
    expect(container.querySelector('.desktop-sidebar .lucide-chef-hat')).not.toBeNull();
    expect(container.querySelector('.desktop-sidebar .brand-mark')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Household overview' })).not.toBeNull();
  });

  it('exposes notification settings without sign-out actions in the shell', () => {
    renderAppShell({
      props: { isDev: false, buildUrlWithAuth: (url: string) => url }
    });

    expect(screen.getAllByRole('link', { name: 'Notification settings' })[0]?.getAttribute('href')).toBe(
      '/settings/notifications'
    );
    expect(screen.queryByRole('button', { name: 'Log out' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Sign out' })).toBeNull();
  });

  it('navigates between Home routes without reloading the document', async () => {
    const router = createTestRouter();
    await router.push('/');

    renderAppShell(
      {
        props: { isDev: false, buildUrlWithAuth: (url: string) => url }
      },
      router
    );

    await screen.getAllByRole('link', { name: 'Notification settings' })[0]?.click();

    await waitFor(() => expect(router.currentRoute.value.fullPath).toBe('/settings/notifications'));
  });

  it('adds Clerk handoff tokens to local cross-zone links', () => {
    renderAppShell({
      props: {
        isDev: true,
        buildUrlWithAuth: (url: string) => `${url}?__clerk_db_jwt=dev-token`
      }
    });

    for (const budgetLink of screen.getAllByRole('link', { name: 'Budget' })) {
      expect(budgetLink.getAttribute('href')).toBe('http://localhost:3001/?__clerk_db_jwt=dev-token');
    }
  });
});
