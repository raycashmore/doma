import type { Doc } from '../_generated/dataModel';

export type DueState = 'overdue' | 'dueToday' | 'upcoming' | 'none';

export const dueStateRank = { overdue: 0, dueToday: 1, upcoming: 2, none: 3 } satisfies Record<DueState, number>;

export function dueStateFor(dueDate: string | undefined, localDate: string): DueState {
  if (!dueDate) return 'none';
  if (dueDate < localDate) return 'overdue';
  return dueDate === localDate ? 'dueToday' : 'upcoming';
}

/** A forwarded-email notice still belongs on the board: not archived, superseded or expired. */
export function isActiveEmailNotice(
  notice: Pick<Doc<'emailNotices'>, 'archivedAt' | 'supersededAt' | 'expiresAt'>,
  nowMs: number
) {
  return (
    notice.archivedAt === undefined &&
    notice.supersededAt === undefined &&
    (notice.expiresAt === undefined || notice.expiresAt > nowMs)
  );
}
