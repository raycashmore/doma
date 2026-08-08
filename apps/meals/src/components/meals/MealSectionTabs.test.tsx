import { RouterContextProvider, createMemoryHistory, createRouter } from '@tanstack/react-router';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MealSectionTabs } from './MealSectionTabs';

import { routeTree } from '@/routeTree.gen';

beforeEach(() => vi.stubGlobal('scrollTo', vi.fn()));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('MealSectionTabs', () => {
  it('opens the generated recipe collection route under the production base path', async () => {
    const router = createRouter({
      routeTree,
      basepath: '/meals',
      history: createMemoryHistory({ initialEntries: ['/meals/week'] })
    });

    await router.load();
    render(
      <RouterContextProvider router={router}>
        <MealSectionTabs active="week" />
      </RouterContextProvider>
    );

    const mealsLink = screen.getByRole('link', { name: 'Meals' });
    expect(mealsLink.getAttribute('href')).toBe('/meals/recipes');
    fireEvent.click(mealsLink);

    await waitFor(() => expect(router.state.location.pathname).toBe('/recipes'));
    expect(router.state.matches.at(-1)?.routeId).toBe('/_tabs/recipes/');
  });
});
