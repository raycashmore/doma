import { useConvexQuery } from 'convex-vue';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useActiveBoard } from './useActiveBoard';

vi.mock('convex-vue', () => ({
  useConvexQuery: vi.fn()
}));

describe('useActiveBoard', () => {
  beforeEach(() => vi.mocked(useConvexQuery).mockReset());

  it('exposes the active board as a live Home-local query', () => {
    vi.mocked(useConvexQuery).mockReturnValue({
      data: ref({ localDate: '2026-07-14', timeZone: 'Australia/Sydney', items: [] }),
      error: ref(null),
      isPending: ref(false),
      suspense: vi.fn()
    });

    const board = useActiveBoard();

    expect(useConvexQuery).toHaveBeenCalledOnce();
    expect(board.data.value?.localDate).toBe('2026-07-14');
  });
});
