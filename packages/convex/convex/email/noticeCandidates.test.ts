import { describe, expect, it } from 'vitest';

import { readActiveEmailNoticeCandidates } from './noticeCandidates';

function createContext({
  notices,
  archives = []
}: {
  notices: Record<string, unknown>[];
  archives?: Record<string, unknown>[];
}) {
  return {
    db: {
      query(table: 'emailNotices' | 'boardArchives') {
        return {
          collect: async () => (table === 'emailNotices' ? notices : archives)
        };
      }
    }
  };
}

describe('readActiveEmailNoticeCandidates', () => {
  it('returns only visible notices without private source references', async () => {
    const ctx = createContext({
      notices: [
        {
          _id: 'email_current',
          capturedEmailId: 'capturedEmails_private',
          fromEmail: 'private-sender@example.com',
          category: 'school',
          title: 'Updated event time',
          body: 'The event now starts later.',
          rawBody: 'private raw body',
          extractedFacts: [{ label: 'Starts', value: '10:00' }],
          obligation: null,
          createdAt: 90
        },
        {
          _id: 'email_expired',
          capturedEmailId: 'capturedEmails_expired',
          category: 'school',
          title: 'Expired',
          body: 'Expired body',
          extractedFacts: [],
          obligation: null,
          createdAt: 95,
          expiresAt: 100
        },
        {
          _id: 'email_source_archived',
          capturedEmailId: 'capturedEmails_archived',
          category: 'admin',
          title: 'Archived',
          body: 'Archived body',
          extractedFacts: [],
          obligation: null,
          createdAt: 94,
          archivedAt: 99
        },
        {
          _id: 'email_superseded',
          capturedEmailId: 'capturedEmails_superseded',
          category: 'schedule',
          title: 'Superseded',
          body: 'Superseded body',
          extractedFacts: [],
          obligation: null,
          createdAt: 93,
          supersededAt: 99
        },
        {
          _id: 'email_home_archived',
          capturedEmailId: 'capturedEmails_home_archived',
          category: 'other',
          title: 'Home archived',
          body: 'Home archived body',
          extractedFacts: [],
          obligation: null,
          createdAt: 92
        }
      ],
      archives: [
        {
          _id: 'boardArchives_1',
          occurrenceId: 'emailNotice:email_home_archived',
          sourceKind: 'forwardedEmail',
          archivedByUserId: 'user_123',
          archivedAt: 99
        }
      ]
    });

    expect(await readActiveEmailNoticeCandidates(ctx as never, { nowMs: 100 })).toEqual([
      {
        id: 'email_current',
        category: 'school',
        title: 'Updated event time',
        body: 'The event now starts later.',
        extractedFacts: [{ label: 'Starts', value: '10:00' }],
        obligation: null,
        createdAt: 90
      }
    ]);
    expect(JSON.stringify(await readActiveEmailNoticeCandidates(ctx as never, { nowMs: 100 }))).not.toContain(
      'private raw body'
    );
    expect(JSON.stringify(await readActiveEmailNoticeCandidates(ctx as never, { nowMs: 100 }))).not.toContain(
      'capturedEmails_private'
    );
    expect(JSON.stringify(await readActiveEmailNoticeCandidates(ctx as never, { nowMs: 100 }))).not.toContain(
      'private-sender@example.com'
    );
  });

  it('caps visible notices at the twenty newest records', async () => {
    const ctx = createContext({
      notices: Array.from({ length: 21 }, (_, index) => ({
        _id: `email_${index}`,
        capturedEmailId: `capturedEmails_${index}`,
        category: 'admin',
        title: `Notice ${index}`,
        body: `Body ${index}`,
        extractedFacts: [],
        obligation: {
          action: `Action ${index}`,
          dueOn: '2026-08-01',
          dueDateConfidence: 'high',
          dueDateEvidence: 'private evidence'
        },
        createdAt: index
      }))
    });

    const candidates = await readActiveEmailNoticeCandidates(ctx as never, { nowMs: 100 });

    expect(candidates).toHaveLength(20);
    expect(candidates.map((candidate) => candidate.id)).toEqual(
      Array.from({ length: 20 }, (_, index) => `email_${20 - index}`)
    );
    expect(candidates[0]?.obligation).toEqual({ action: 'Action 20', dueOn: '2026-08-01' });
  });
});
