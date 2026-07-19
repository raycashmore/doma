import { api } from '@repo/convex';
import { useConvexQuery } from 'convex-vue';
import { getCurrentScope, onScopeDispose, ref } from 'vue';

const ACTIVE_BOARD_CLOCK_INTERVAL_MS = 30_000;

export function useActiveBoard() {
  const refreshToken = ref(0);
  const interval = globalThis.setInterval(() => {
    refreshToken.value += 1;
  }, ACTIVE_BOARD_CLOCK_INTERVAL_MS);

  if (getCurrentScope()) onScopeDispose(() => globalThis.clearInterval(interval));

  return useConvexQuery(api.home.activeBoard.activeBoard, () => ({ refreshToken: refreshToken.value }));
}
