import { createMemoryHistory, createRouter } from '@tanstack/react-router';
import { describe, expect, it } from 'vitest';

import { routeTree } from '@/routeTree.gen';

describe('Meals landing route', () => {
  it('opens the Week view by default', async () => {
    const router = createRouter({
      routeTree,
      history: createMemoryHistory({ initialEntries: ['/'] })
    });

    await router.load();

    expect(router.state.location.pathname).toBe('/week');
  });
});
