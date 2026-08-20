import { describe, expect, it, vi } from 'vitest';

const triageMocks = vi.hoisted(() => ({
  action: vi.fn((definition) => definition),
  internalAction: vi.fn((definition) => definition),
  internalMutation: vi.fn((definition) => definition),
  mutation: vi.fn((definition) => definition),
  query: vi.fn((definition) => definition)
}));

vi.mock('../_generated/server', () => triageMocks);
vi.mock('../_generated/api', () => ({
  internal: {
    email: {
      triage: {
        claimNextPendingCapturedEmail: Symbol('claimNextPendingCapturedEmail'),
        recordCapturedEmailTriageFailure: Symbol('recordCapturedEmailTriageFailure')
      },
      agentResult: { recordAgentResult: Symbol('recordAgentResult') }
    }
  }
}));

type CapturedEmail = { _id: string; processingState: string; triageFailureReason?: string };

function createContext(email: CapturedEmail | null) {
  return {
    db: {
      get: vi.fn(async () => email),
      patch: vi.fn(async (_id: string, patch: Partial<CapturedEmail>) => {
        if (email) Object.assign(email, patch);
      })
    }
  };
}

describe('retryFailedCapturedEmailForBot', () => {
  it('rejects an unauthorized service token before reading the captured email', async () => {
    vi.stubEnv('BOT_SERVICE_TOKEN', 'expected-token');
    const { retryFailedCapturedEmailForBot } = (await import('./triage')) as unknown as {
      retryFailedCapturedEmailForBot: {
        handler: (
          ctx: ReturnType<typeof createContext>,
          args: { serviceToken: string; capturedEmailId: string }
        ) => Promise<unknown>;
      };
    };
    const ctx = createContext({ _id: 'capturedEmails_123', processingState: 'failed' });

    await expect(
      retryFailedCapturedEmailForBot.handler(ctx, {
        serviceToken: 'wrong-token',
        capturedEmailId: 'capturedEmails_123'
      })
    ).rejects.toThrow('Unauthorized');
    expect(ctx.db.get).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('rejects a nonexistent captured email', async () => {
    vi.stubEnv('BOT_SERVICE_TOKEN', 'expected-token');
    const { retryFailedCapturedEmailForBot } = (await import('./triage')) as unknown as {
      retryFailedCapturedEmailForBot: {
        handler: (
          ctx: ReturnType<typeof createContext>,
          args: { serviceToken: string; capturedEmailId: string }
        ) => Promise<unknown>;
      };
    };
    const ctx = createContext(null);

    await expect(
      retryFailedCapturedEmailForBot.handler(ctx, {
        serviceToken: 'expected-token',
        capturedEmailId: 'capturedEmails_missing'
      })
    ).rejects.toThrow('Captured email not found');
    vi.unstubAllEnvs();
  });

  it('leaves a non-failed email unchanged', async () => {
    vi.stubEnv('BOT_SERVICE_TOKEN', 'expected-token');
    const { retryFailedCapturedEmailForBot } = (await import('./triage')) as unknown as {
      retryFailedCapturedEmailForBot: {
        handler: (
          ctx: ReturnType<typeof createContext>,
          args: { serviceToken: string; capturedEmailId: string }
        ) => Promise<unknown>;
      };
    };
    const ctx = createContext({ _id: 'capturedEmails_123', processingState: 'noticeCreated' });

    await expect(
      retryFailedCapturedEmailForBot.handler(ctx, {
        serviceToken: 'expected-token',
        capturedEmailId: 'capturedEmails_123'
      })
    ).resolves.toEqual({ status: 'noticeCreated', capturedEmailId: 'capturedEmails_123' });
    expect(ctx.db.patch).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it('requeues a failed email and clears its failure reason', async () => {
    vi.stubEnv('BOT_SERVICE_TOKEN', 'expected-token');
    const { retryFailedCapturedEmailForBot } = (await import('./triage')) as unknown as {
      retryFailedCapturedEmailForBot: {
        handler: (
          ctx: ReturnType<typeof createContext>,
          args: { serviceToken: string; capturedEmailId: string }
        ) => Promise<unknown>;
      };
    };
    const ctx = createContext({
      _id: 'capturedEmails_123',
      processingState: 'failed',
      triageFailureReason: 'provider_failure'
    });

    await expect(
      retryFailedCapturedEmailForBot.handler(ctx, {
        serviceToken: 'expected-token',
        capturedEmailId: 'capturedEmails_123'
      })
    ).resolves.toEqual({ status: 'pending', capturedEmailId: 'capturedEmails_123' });
    expect(ctx.db.patch).toHaveBeenCalledWith(
      'capturedEmails_123',
      expect.objectContaining({ processingState: 'pending', triageFailureReason: undefined })
    );
    vi.unstubAllEnvs();
  });
});
