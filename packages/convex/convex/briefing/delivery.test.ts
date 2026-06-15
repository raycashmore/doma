import { describe, expect, it, vi } from 'vitest';

import { type BotMorningBriefing, runMorningBriefingDeliveryCycle } from './delivery';

const timeZone = 'Australia/Sydney';
const dueAtMs = Date.parse('2026-06-12T21:30:00.000Z'); // 7:30am 2026-06-13 in Sydney
const briefing: BotMorningBriefing = {
  briefingKey: 'morning:2026-06-13',
  localDate: '2026-06-13',
  generationStatus: 'ai',
  shouldSend: true,
  message: 'Morning briefing\nPack / bring\n- memberA: Bring library bag.'
};

describe('runMorningBriefingDeliveryCycle', () => {
  it('does not sync, generate, send, or record outside the local morning retry window', async () => {
    const syncSchedule = vi.fn();
    const loadBriefing = vi.fn();
    const generateBriefing = vi.fn();
    const sendNotification = vi.fn();
    const recordDeliveryAttempt = vi.fn();

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: Date.parse('2026-06-12T21:29:00.000Z'), // 7:29am in Sydney
        timeZone,
        recipientUserIds: ['user_123'],
        attempts: [],
        lastSyncedAt: dueAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      outsideDeliveryWindow: true,
      syncFailed: false,
      staleCache: false,
      generated: false
    });

    expect(syncSchedule).not.toHaveBeenCalled();
    expect(loadBriefing).not.toHaveBeenCalled();
    expect(generateBriefing).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordDeliveryAttempt).not.toHaveBeenCalled();
  });

  it('forces schedule sync, generates one briefing for the local day, and sends it to all recipients', async () => {
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: dueAtMs }));
    const loadBriefing = vi.fn(async () => null);
    const generateBriefing = vi.fn(async () => briefing);
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        recipientUserIds: ['user_123', 'user_456'],
        attempts: [],
        lastSyncedAt: dueAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 2,
      sent: 2,
      skipped: 0,
      failed: 0,
      outsideDeliveryWindow: false,
      syncFailed: false,
      staleCache: false,
      generated: true
    });

    expect(syncSchedule).toHaveBeenCalledOnce();
    expect(loadBriefing).toHaveBeenCalledWith({ localDate: '2026-06-13' });
    expect(generateBriefing).toHaveBeenCalledWith({
      localDate: '2026-06-13',
      timeZone,
      generatedAt: dueAtMs
    });
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_123',
      topic: 'briefing.morning',
      message: briefing.message,
      metadata: {
        briefingKey: briefing.briefingKey,
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });
    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_456',
      topic: 'briefing.morning',
      message: briefing.message,
      metadata: {
        briefingKey: briefing.briefingKey,
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: briefing.briefingKey,
      recipientUserId: 'user_123',
      attemptedAt: dueAtMs,
      status: 'pending'
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: briefing.briefingKey,
      recipientUserId: 'user_123',
      attemptedAt: dueAtMs,
      status: 'sent'
    });
  });

  it('does not sync or generate when no briefing recipients are configured', async () => {
    const syncSchedule = vi.fn();
    const loadBriefing = vi.fn();
    const generateBriefing = vi.fn();
    const sendNotification = vi.fn();
    const recordDeliveryAttempt = vi.fn();

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        recipientUserIds: [],
        attempts: [],
        lastSyncedAt: dueAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toEqual({
      processed: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      outsideDeliveryWindow: false,
      syncFailed: false,
      staleCache: false,
      generated: false
    });

    expect(syncSchedule).not.toHaveBeenCalled();
    expect(loadBriefing).not.toHaveBeenCalled();
    expect(generateBriefing).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordDeliveryAttempt).not.toHaveBeenCalled();
  });

  it('reuses a stored briefing for retries and does not resend to recipients already delivered', async () => {
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: dueAtMs }));
    const loadBriefing = vi.fn(async () => briefing);
    const generateBriefing = vi.fn();
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        recipientUserIds: ['user_done', 'user_retry'],
        attempts: [
          { briefingKey: briefing.briefingKey, recipientUserId: 'user_done', status: 'sent' },
          { briefingKey: briefing.briefingKey, recipientUserId: 'user_retry', status: 'failed' }
        ],
        lastSyncedAt: dueAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toMatchObject({
      processed: 1,
      sent: 1,
      generated: false
    });

    expect(generateBriefing).not.toHaveBeenCalled();
    expect(sendNotification).toHaveBeenCalledOnce();
    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_retry',
      topic: 'briefing.morning',
      message: briefing.message,
      metadata: {
        briefingKey: briefing.briefingKey,
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });
  });

  it('includes a small stale-data note when forced sync fails and cached schedule data is older than 12 hours', async () => {
    const staleLastSyncedAt = dueAtMs - 13 * 60 * 60_000;
    const syncSchedule = vi.fn(async () => ({ ok: false as const, lastSyncedAt: staleLastSyncedAt }));
    const loadBriefing = vi.fn(async () => null);
    const generateBriefing = vi.fn(async () => briefing);
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        recipientUserIds: ['user_123'],
        attempts: [],
        lastSyncedAt: staleLastSyncedAt,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toMatchObject({
      processed: 1,
      sent: 1,
      syncFailed: true,
      staleCache: true,
      generated: true
    });

    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_123',
      topic: 'briefing.morning',
      message: `${briefing.message}\nNote: schedule data may be stale because the latest calendar sync failed.`,
      metadata: {
        briefingKey: briefing.briefingKey,
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });
  });

  it('keeps the normal message when forced sync fails but cached schedule data is still recent', async () => {
    const recentLastSyncedAt = dueAtMs - 2 * 60 * 60_000;
    const syncSchedule = vi.fn(async () => ({ ok: false as const, lastSyncedAt: recentLastSyncedAt }));
    const loadBriefing = vi.fn(async () => briefing);
    const generateBriefing = vi.fn();
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        recipientUserIds: ['user_123'],
        attempts: [],
        lastSyncedAt: recentLastSyncedAt,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toMatchObject({
      syncFailed: true,
      staleCache: false
    });

    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_123',
      topic: 'briefing.morning',
      message: briefing.message,
      metadata: {
        briefingKey: briefing.briefingKey,
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });
  });

  it('does not send when a recipient delivery claim is already held', async () => {
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: dueAtMs }));
    const loadBriefing = vi.fn(async () => briefing);
    const generateBriefing = vi.fn();
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: false as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        recipientUserIds: ['user_123'],
        attempts: [],
        lastSyncedAt: dueAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toMatchObject({
      processed: 0,
      sent: 0,
      generated: false
    });

    expect(sendNotification).not.toHaveBeenCalled();
  });

  it('records suppressed or empty briefings as skipped without sending an empty notification', async () => {
    const suppressedBriefing: BotMorningBriefing = {
      briefingKey: 'morning:2026-06-13',
      localDate: '2026-06-13',
      generationStatus: 'ai',
      shouldSend: false,
      message: ''
    };
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: dueAtMs }));
    const loadBriefing = vi.fn(async () => suppressedBriefing);
    const generateBriefing = vi.fn();
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        recipientUserIds: ['user_123'],
        attempts: [],
        lastSyncedAt: dueAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toMatchObject({
      processed: 1,
      sent: 0,
      skipped: 1,
      failed: 0
    });

    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: suppressedBriefing.briefingKey,
      recipientUserId: 'user_123',
      attemptedAt: dueAtMs,
      status: 'pending'
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: suppressedBriefing.briefingKey,
      recipientUserId: 'user_123',
      attemptedAt: dueAtMs,
      status: 'skipped'
    });
  });
});
