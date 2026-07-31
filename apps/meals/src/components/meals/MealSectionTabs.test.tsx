import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter
} from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MealSectionTabs } from './MealSectionTabs';

beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MealSectionTabs', () => {
  it('opens the recipe collection from the Week view', async () => {
    const rootRoute = createRootRoute();
    const weekRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/week',
      component: () => <MealSectionTabs active="week" />
    });
    const recipesRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/recipes',
      component: () => <p>Recipe collection</p>
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([weekRoute, recipesRoute]),
      history: createMemoryHistory({ initialEntries: ['/week'] })
    });

    await router.load();
    render(<RouterProvider router={router} />);

    fireEvent.click(screen.getByRole('link', { name: 'Meals' }));

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes'));
    expect(screen.getByText('Recipe collection')).toBeDefined();
  });
});
