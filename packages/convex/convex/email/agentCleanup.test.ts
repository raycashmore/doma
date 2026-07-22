import { describe, expect, it, vi } from 'vitest';

import { deleteExpiredEmailTriageRunsHandler } from './agentCleanup';

describe('deleteExpiredEmailTriageRunsHandler', () => {
  it('cleans a high-throughput batch of expired traces', async () => {
    const expired = Array.from({ length: 500 }, (_, index) => ({ _id: `run_${index}` }));
    const take = vi.fn().mockResolvedValue(expired);
    const remove = vi.fn();
    const ctx = {
      db: {
        query: () => ({ withIndex: () => ({ take }) }),
        delete: remove
      }
    };

    await expect(deleteExpiredEmailTriageRunsHandler(ctx as never, 1_000)).resolves.toBe(500);
    expect(take).toHaveBeenCalledWith(500);
    expect(remove).toHaveBeenCalledTimes(500);
  });
});
