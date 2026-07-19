import { api } from '@repo/convex';
import { useConvexQuery } from 'convex-vue';

export function useActiveBoard() {
  return useConvexQuery(api.home.activeBoard.activeBoard);
}
