import type { QueryCtx } from '../_generated/server';

export type ActiveEmailNoticeCandidate = {
  id: string;
  category: 'school' | 'admin' | 'schedule' | 'finance' | 'other';
  title: string;
  body: string;
  extractedFacts: Array<{ label: string; value: string }>;
  obligation: {
    action: string;
    dueOn: string;
  } | null;
  createdAt: number;
};

type EmailNoticeRow = {
  _id: string;
  category: ActiveEmailNoticeCandidate['category'];
  title: string;
  body: string;
  extractedFacts: Array<{ label: string; value: string }>;
  obligation?: {
    action: string;
    dueOn: string;
  } | null;
  createdAt: number;
  archivedAt?: number;
  expiresAt?: number;
  supersededAt?: number;
};

export async function readActiveEmailNoticeCandidates(
  ctx: Pick<QueryCtx, 'db'>,
  options: { nowMs: number; limit?: number }
): Promise<ActiveEmailNoticeCandidate[]> {
  const [notices, archives] = await Promise.all([
    ctx.db.query('emailNotices').collect(),
    ctx.db.query('boardArchives').collect()
  ]);
  const archivedOccurrenceIds = new Set(archives.map((archive) => archive.occurrenceId));
  const isActive = (notice: EmailNoticeRow) =>
    notice.archivedAt === undefined &&
    notice.supersededAt === undefined &&
    (notice.expiresAt === undefined || notice.expiresAt > options.nowMs) &&
    !archivedOccurrenceIds.has(`emailNotice:${notice._id}`);

  return (notices as EmailNoticeRow[])
    .filter(isActive)
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, options.limit ?? 20)
    .map((notice) => ({
      id: notice._id,
      category: notice.category,
      title: notice.title,
      body: notice.body,
      extractedFacts: notice.extractedFacts,
      obligation: notice.obligation ? { action: notice.obligation.action, dueOn: notice.obligation.dueOn } : null,
      createdAt: notice.createdAt
    }));
}
