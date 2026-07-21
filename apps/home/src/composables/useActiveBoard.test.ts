import { useConvexQuery } from 'convex-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import { useActiveBoard } from './useActiveBoard';

vi.mock('convex-vue', () => ({
  useConvexQuery: vi.fn()
}));

describe('useActiveBoard', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(useConvexQuery).mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('exposes the active board as a live Home-local query', () => {
    vi.mocked(useConvexQuery).mockReturnValue({
      data: ref({ localDate: '2026-07-14', timeZone: 'Australia/Sydney', items: [] }),
      error: ref(null),
      isPending: ref(false),
      suspense: vi.fn()
    });

    const board = useActiveBoard();

    expect(useConvexQuery).toHaveBeenCalledOnce();
    const args = vi.mocked(useConvexQuery).mock.calls[0]?.[1];
    expect(typeof args === 'function' ? args() : args).toEqual({ refreshToken: 0 });

    vi.advanceTimersByTime(30_000);
    expect(typeof args === 'function' ? args() : args).toEqual({ refreshToken: 1 });
    expect(board.data.value?.localDate).toBe('2026-07-14');
  });
});
