import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { routeTree } from '@/routeTree.gen';

describe('Meals landing route', () => {
  it('opens the Week view by default under the production base path', async () => {
    const router = createRouter({
      routeTree,
      basepath: '/meals',
      history: createMemoryHistory({ initialEntries: ['/meals/'] })
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/week');
    expect(router.buildLocation({ to: '/week' }).href).toBe('/meals/week');
  });

  it('direct-loads the generated recipe collection under the production base path', async () => {
    const router = createRouter({
      routeTree,
      basepath: '/meals',
      history: createMemoryHistory({ initialEntries: ['/meals/recipes/'] })
    });

    await router.load();

    expect(router.state.matches.at(-1)?.routeId).toBe('/recipes/');
  });
});
