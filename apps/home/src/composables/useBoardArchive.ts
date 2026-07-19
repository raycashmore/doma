import { api } from '@repo/convex';
import type { FunctionReturnType } from 'convex/server';
import { useConvexMutation } from 'convex-vue';

type ActiveBoardData = FunctionReturnType<typeof api.home.activeBoard.activeBoard>;
export type ArchiveableBoardItem = ActiveBoardData['items'][number];

export function useBoardArchive() {
  const mutation = useConvexMutation(api.home.archives.archiveBoardItem);
  return {
    isPending: mutation.isPending,
    archive: (item: ArchiveableBoardItem) => mutation.mutate({ occurrenceId: item.id, sourceKind: item.sourceKind })
  };
}
