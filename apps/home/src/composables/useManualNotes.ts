import { api } from '@repo/convex';
import type { FunctionReturnType } from 'convex/server';
import { useConvexMutation } from 'convex-vue';

type ActiveBoardData = FunctionReturnType<typeof api.home.activeBoard.activeBoard>;
export type ManualNoteItem = Extract<ActiveBoardData['items'][number], { kind: 'manualNote' }>;
export type ManualNoteInput = { title: string; detail?: string; dueDate?: string };

export function useManualNotes() {
  const create = useConvexMutation(api.home.manualNotes.createManualNote);
  const update = useConvexMutation(api.home.manualNotes.updateManualNote);

  return {
    isPending: () => create.isPending.value || update.isPending.value,
    async save(note: ManualNoteItem | null, input: ManualNoteInput) {
      if (note) return update.mutate({ noteId: note.noteId, ...input });
      return create.mutate(input);
    }
  };
}
