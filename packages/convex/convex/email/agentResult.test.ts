import { describe, expect, it, vi } from 'vitest';

import { persistEmailTriageAgentResult } from './agentResult';

function createCtx(processingState = 'processing') {
  const rows: Record<string, Record<string, unknown>> = {
    capturedEmails_123: { _id: 'capturedEmails_123', processingState }
  };
  let nextId = 1;
  const insert = vi.fn(async (table: string, row: Record<string, unknown>) => {
    const id = `${table}_${nextId++}`;
    rows[id] = { _id: id, ...row };
    return id;
  });
  const patch = vi.fn(async (id: string, row: Record<string, unknown>) => Object.assign(rows[id] ?? {}, row));
  return { ctx: { db: { get: async (id: string) => rows[id] ?? null, insert, patch } }, rows, insert };
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
          }
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
          }
        }
      }
    });
    expect(insert).not.toHaveBeenCalledWith('emailReminderCandidates', expect.anything());
  });
});
