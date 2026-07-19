import { api } from '@repo/convex';
import { useConvexQuery } from 'convex-vue';

export function useHomeConnection() {
  return useConvexQuery(api.authStatus.status);
}
