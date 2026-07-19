import { useConvexQuery } from 'convex-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useHomeConnection } from './useHomeConnection';

vi.mock('convex-vue', () => ({
  useConvexQuery: vi.fn()
}));

describe('useHomeConnection', () => {
  beforeEach(() => vi.mocked(useConvexQuery).mockReset());

  it('exposes the authenticated Convex live-query state through a Home-local composable', () => {
    vi.mocked(useConvexQuery).mockReturnValue({
      data: ref({ isAuthenticated: true, userLabel: 'Household user' }),
      error: ref(null),
      isPending: ref(false),
      suspense: vi.fn()
    });

    const connection = useHomeConnection();

    expect(useConvexQuery).toHaveBeenCalledOnce();
    expect(connection.data.value).toEqual({ isAuthenticated: true, userLabel: 'Household user' });
    expect(connection.isPending.value).toBe(false);
  });
});
