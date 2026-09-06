import { describe, expect, it, vi } from 'vitest';

import { persistEmailTriageAgentResult } from './agentResult';

function createCtx({
  processingState = 'processing',
  notices = [],
  archives = [],
  failNoticeInsert = false
}: {
  processingState?: string;
  notices?: Array<Record<string, unknown>>;
  archives?: Array<Record<string, unknown>>;
  failNoticeInsert?: boolean;
} = {}) {
  const rows: Record<string, Record<string, unknown>> = {
    capturedEmails_123: { _id: 'capturedEmails_123', processingState },
    ...Object.fromEntries(notices.map((notice) => [String(notice._id), notice])),
    ...Object.fromEntries(archives.map((archive) => [String(archive._id), archive]))
  };
  let nextId = 1;
  const insert = vi.fn(async (table: string, row: Record<string, unknown>) => {
    if (failNoticeInsert && table === 'emailNotices') throw new Error('notice insert failed');
    const id = `${table}_${nextId++}`;
    rows[id] = { _id: id, ...row };
    return id;
  });
  const patch = vi.fn(async (id: string, row: Record<string, unknown>) => Object.assign(rows[id] ?? {}, row));
  const query = (table: 'emailNotices' | 'boardArchives') => ({
    collect: async () => Object.values(rows).filter((row) => String(row._id).startsWith(`${table}_`))
  });
  return { ctx: { db: { get: async (id: string) => rows[id] ?? null, insert, patch, query } }, rows, insert, patch };
}

function noticeOutcome({
  relevance = { relevantThrough: null, dateConfidence: 'low', dateEvidence: '' },
  supersession = { noticeId: null, confidence: 'low', evidence: '' }
}: {
  relevance?: { relevantThrough: string | null; dateConfidence: 'low' | 'medium' | 'high'; dateEvidence: string };
  supersession?: { noticeId: string | null; confidence: 'low' | 'medium' | 'high'; evidence: string };
} = {}) {
  return {
    runId: 'email_run_123',
    status: 'completed' as const,
    outcome: {
      kind: 'notice' as const,
      category: 'admin' as const,
      priority: 'high' as const,
      title: 'Submit form',
      body: 'The form needs to be submitted.',
      extractedFacts: [],
      obligation: null,
      relevance,
      supersession
    }
  };
}

describe('persistEmailTriageAgentResult', () => {
  it('stores the canonical Home notice and a strict reminder candidate in one mutation', async () => {
    const { ctx, rows } = createCtx();
    const result = await persistEmailTriageAgentResult(ctx as never, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-21T02:00:00.000Z'),
      result: {
        runId: 'email_run_123',
        status: 'completed',
        outcome: {
          kind: 'notice',
          category: 'admin',
          priority: 'high',
          title: 'Submit permission form',
          body: 'The permission form needs to be submitted.',
          extractedFacts: [],
          obligation: {
            action: 'Submit the permission form',
            dueOn: '2026-07-31',
            dueDateConfidence: 'high',
            dueDateEvidence: 'The form is due 31 July.'
          },
          relevance: { relevantThrough: null, dateConfidence: 'low', dateEvidence: '' },
          supersession: { noticeId: null, confidence: 'low', evidence: '' }
        }
      }
    });

    expect(result).toEqual({
      status: 'noticeCreated',
      capturedEmailId: 'capturedEmails_123',
      noticeId: 'emailNotices_1',
      reminderCandidateId: 'emailReminderCandidates_2'
    });
    expect(rows.emailNotices_1).toMatchObject({ telegramWorthy: false, triageRunId: 'email_run_123' });
    expect(rows.emailReminderCandidates_2).toMatchObject({
      noticeId: 'emailNotices_1',
      dueOn: '2026-07-31',
      reminderAt: Date.parse('2026-07-30T09:00:00.000Z')
    });
  });

  it('keeps an uncertain obligation on Home without scheduling a reminder', async () => {
    const { ctx, insert } = createCtx();
    await persistEmailTriageAgentResult(ctx as never, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-21T02:00:00.000Z'),
      result: {
        runId: 'email_run_123',
        status: 'completed',
        outcome: {
          kind: 'notice',
          category: 'admin',
          priority: 'high',
          title: 'Possible form deadline',
          body: 'A form may need attention.',
          extractedFacts: [],
          obligation: {
            action: 'Check the form',
            dueOn: '2026-07-31',
            dueDateConfidence: 'medium',
            dueDateEvidence: 'The date is implied.'
          },
          relevance: { relevantThrough: null, dateConfidence: 'low', dateEvidence: '' },
          supersession: { noticeId: null, confidence: 'low', evidence: '' }
        }
      }
    });
    expect(insert).not.toHaveBeenCalledWith('emailReminderCandidates', expect.anything());
  });

  it('creates a reminder candidate for a medium-priority obligation with a high-confidence date', async () => {
    const { ctx, insert } = createCtx();
    await persistEmailTriageAgentResult(ctx as never, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-21T02:00:00.000Z'),
      result: {
        runId: 'email_run_123',
        status: 'completed',
        outcome: {
          kind: 'notice',
          category: 'admin',
          priority: 'medium',
          title: 'Return form',
          body: 'The form should be returned.',
          extractedFacts: [],
          obligation: {
            action: 'Return the form',
            dueOn: '2026-07-31',
            dueDateConfidence: 'high',
            dueDateEvidence: 'The form is due 31 July.'
          },
          relevance: { relevantThrough: null, dateConfidence: 'low', dateEvidence: '' },
          supersession: { noticeId: null, confidence: 'low', evidence: '' }
        }
      }
    });

    expect(insert).toHaveBeenCalledWith(
      'emailReminderCandidates',
      expect.objectContaining({ action: 'Return the form', dueOn: '2026-07-31' })
    );
  });

  it('writes expiry from a grounded relevance date', async () => {
    const { ctx, rows } = createCtx();
    await persistEmailTriageAgentResult(ctx as never, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-21T02:00:00.000Z'),
      result: noticeOutcome({
        relevance: {
          relevantThrough: '2026-07-24',
          dateConfidence: 'high',
          dateEvidence: 'The form applies through 24 July.'
        }
      }) as never
    });

    expect(rows.emailNotices_1).toMatchObject({ expiresAt: Date.parse('2026-07-24T14:00:00.000Z') });
  });

  it('writes the fourteen-day fallback expiry without a trustworthy date', async () => {
    const { ctx, rows } = createCtx();
    await persistEmailTriageAgentResult(ctx as never, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-21T02:00:00.000Z'),
      result: noticeOutcome() as never
    });

    expect(rows.emailNotices_1).toMatchObject({ expiresAt: Date.parse('2026-08-03T14:00:00.000Z') });
  });

  it('supersedes a high-confidence active candidate after inserting the replacement', async () => {
    const predecessor = {
      _id: 'emailNotices_older',
      category: 'admin',
      title: 'Earlier form',
      body: 'An earlier form notice.',
      extractedFacts: [],
      obligation: null,
      createdAt: 1
    };
    const { ctx, rows, insert, patch } = createCtx({ notices: [predecessor] });
    await persistEmailTriageAgentResult(ctx as never, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: 100,
      result: noticeOutcome({
        supersession: {
          noticeId: 'emailNotices_older',
          confidence: 'high',
          evidence: 'This is the updated form notice.'
        }
      }) as never
    });

    expect(rows.emailNotices_older).toMatchObject({ supersededAt: 100, updatedAt: 100 });
    expect(insert.mock.invocationCallOrder[0]).toBeLessThan(
      patch.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    );
  });

  it.each([
    ['Home-archived', { archivedAt: 1 }, []],
    ['expired', { expiresAt: 100 }, []],
    ['superseded', { supersededAt: 1 }, []],
    ['source-archived', {}, [{ _id: 'boardArchives_1', occurrenceId: 'emailNotice:emailNotices_older' }]]
  ])('does not supersede a %s candidate', async (_label, lifecycle, archives) => {
    const { ctx, rows, patch } = createCtx({
      notices: [
        {
          _id: 'emailNotices_older',
          category: 'admin',
          title: 'Earlier form',
          body: 'An earlier form notice.',
          extractedFacts: [],
          obligation: null,
          createdAt: 1,
          ...lifecycle
        }
      ],
      archives
    });
    await persistEmailTriageAgentResult(ctx as never, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: 100,
      result: noticeOutcome({
        supersession: { noticeId: 'emailNotices_older', confidence: 'high', evidence: 'A proposed update.' }
      }) as never
    });

    expect(rows.emailNotices_older).not.toHaveProperty('supersededAt', 100);
    expect(patch).not.toHaveBeenCalledWith('emailNotices_older', expect.anything());
  });

  it('does not supersede the twenty-first active candidate', async () => {
    const notices = Array.from({ length: 21 }, (_, index) => ({
      _id: `emailNotices_${index + 1}`,
      category: 'admin',
      title: `Notice ${index + 1}`,
      body: 'An active notice.',
      extractedFacts: [],
      obligation: null,
      createdAt: index + 1
    }));
    const { ctx, rows, patch } = createCtx({ notices });
    await persistEmailTriageAgentResult(ctx as never, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: 100,
      result: noticeOutcome({
        supersession: { noticeId: 'emailNotices_1', confidence: 'high', evidence: 'A proposed update.' }
      }) as never
    });

    expect(rows.emailNotices_1).not.toHaveProperty('supersededAt', 100);
    expect(patch).not.toHaveBeenCalledWith('emailNotices_1', expect.anything());
  });

  it('leaves a validated predecessor untouched when inserting the replacement fails', async () => {
    const predecessor = {
      _id: 'emailNotices_older',
      category: 'admin',
      title: 'Earlier form',
      body: 'An earlier form notice.',
      extractedFacts: [],
      obligation: null,
      createdAt: 1
    };
    const { ctx, rows, patch } = createCtx({ notices: [predecessor], failNoticeInsert: true });
    await expect(
      persistEmailTriageAgentResult(ctx as never, {
        capturedEmailId: 'capturedEmails_123',
        processedAt: 100,
        result: noticeOutcome({
          supersession: {
            noticeId: 'emailNotices_older',
            confidence: 'high',
            evidence: 'This is the updated form notice.'
          }
        }) as never
      })
    ).rejects.toThrow('notice insert failed');

    expect(rows.emailNotices_older).not.toHaveProperty('supersededAt');
    expect(patch).not.toHaveBeenCalledWith('emailNotices_older', expect.anything());
  });

  it('uses fallback expiry when valid core notice data carries invalid lifecycle metadata', async () => {
    const { ctx, rows } = createCtx();
    await persistEmailTriageAgentResult(ctx as never, {
      capturedEmailId: 'capturedEmails_123',
      processedAt: Date.parse('2026-07-21T02:00:00.000Z'),
      result: noticeOutcome({
        relevance: { relevantThrough: 'invalid-date', dateConfidence: 'high', dateEvidence: 'Not a calendar date.' },
        supersession: { noticeId: 'emailNotices_missing', confidence: 'high', evidence: 'Invalid target.' }
      }) as never
    });

    expect(rows.emailNotices_1).toMatchObject({ expiresAt: Date.parse('2026-08-03T14:00:00.000Z') });
  });

  it('does not create a second notice or supersede a predecessor for a terminal captured email', async () => {
    const { ctx, insert, patch } = createCtx({ processingState: 'noticeCreated' });
    await expect(
      persistEmailTriageAgentResult(ctx as never, {
        capturedEmailId: 'capturedEmails_123',
        processedAt: 100,
        result: noticeOutcome() as never
      })
    ).resolves.toEqual({ status: 'noticeCreated', capturedEmailId: 'capturedEmails_123' });

    expect(insert).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });
});
