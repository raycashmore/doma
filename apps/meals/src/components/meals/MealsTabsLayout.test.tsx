import {
  Outlet,
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter
} from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MealsTabsLayout } from './MealsTabsLayout';

vi.mock('@/config/runtime', () => ({ FIXTURE_MODE: true }));

function createTabsRouter() {
  const rootRoute = createRootRoute({ component: Outlet });
  const tabsRoute = createRoute({
    getParentRoute: () => rootRoute,
    id: 'tabs',
    component: MealsTabsLayout
  });
  const weekRoute = createRoute({
    getParentRoute: () => tabsRoute,
    path: '/week',
    component: () => null
  });
  const recipesRoute = createRoute({
    getParentRoute: () => tabsRoute,
    path: '/recipes',
    component: () => null
  });

  return createRouter({
    routeTree: rootRoute.addChildren([tabsRoute.addChildren([weekRoute, recipesRoute])]),
    history: createMemoryHistory({ initialEntries: ['/week'] })
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: !query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('MealsTabsLayout', () => {
  it('preserves the selected weekday when returning from Meals to Week', async () => {
    const router = createTabsRouter();
    await router.load();
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole('button', { name: 'Select Tuesday 21 July' }));
    expect(within(screen.getByLabelText('Selected day meals')).getByText('Tuesday')).toBeDefined();

    await act(async () => {
      await router.navigate({ to: '/recipes' });
    });
    expect(screen.getByRole('heading', { name: 'Repertoire' })).toBeDefined();

    await act(async () => {
      await router.navigate({ to: '/week' });
    });
    expect(within(screen.getByLabelText('Selected day meals')).getByText('Tuesday')).toBeDefined();
  });
});
