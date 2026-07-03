import { describe, expect, it, vi } from 'vitest';

import type { ScheduleDisplayMember } from '../schedule/config';
import { type BotMorningBriefing, runMorningBriefingDeliveryCycle } from './delivery';

const timeZone = 'Australia/Sydney';
const dueAtMs = Date.parse('2026-06-12T21:35:00.000Z'); // 7:35am 2026-06-13 in Sydney
const members: ScheduleDisplayMember[] = [{ id: 'childA', label: 'Child A', initials: 'CA' }];
const briefing: BotMorningBriefing = {
  briefingKey: 'morning:2026-06-13',
  localDate: '2026-06-13',
  generationStatus: 'ai',
  shouldSend: true,
  message: 'Today:\nLibrary bag and dancing pickup.',
  briefing: {
    shouldSend: true,
    headline: 'Library bag and dancing pickup.',
    morning: [{ text: 'Bring library bag.', who: ['childA'], sourceIds: ['req:library:1'] }],
    afternoon: [{ text: 'Bring dancing shoes.', who: ['childA'], sourceIds: ['req:dance:1'] }],
    watchouts: [],
    sourceIdsIgnored: []
  }
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
        nowMs: Date.parse('2026-06-12T21:34:00.000Z'), // 7:34am in Sydney
        timeZone,
        members,
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

  it('forces schedule sync, generates one briefing for the local day, and sends the morning slot to all recipients', async () => {
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: dueAtMs }));
    const loadBriefing = vi.fn(async () => null);
    const generateBriefing = vi.fn(async () => briefing);
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        members,
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
      message: `Library bag and dancing pickup.

This morning:
- Child A: Bring library bag.`,
      metadata: {
        briefingKey: briefing.briefingKey,
        deliveryKey: `${briefing.briefingKey}:morning`,
        deliverySlot: 'morning',
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });
    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_456',
      topic: 'briefing.morning',
      message: `Library bag and dancing pickup.

This morning:
- Child A: Bring library bag.`,
      metadata: {
        briefingKey: briefing.briefingKey,
        deliveryKey: `${briefing.briefingKey}:morning`,
        deliverySlot: 'morning',
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: `${briefing.briefingKey}:morning`,
      recipientUserId: 'user_123',
      attemptedAt: dueAtMs,
      status: 'pending'
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: `${briefing.briefingKey}:morning`,
      recipientUserId: 'user_123',
      attemptedAt: dueAtMs,
      status: 'sent'
    });
  });

  it('does not send a generated briefing with invalid stored structured content', async () => {
    const invalidBriefing: BotMorningBriefing = {
      ...briefing,
      briefing: {
        shouldSend: true,
        headline: 'Library day.',
        morning: [{ text: 'Bring <b>library</b> bag.', who: ['childA'], sourceIds: ['req:library:1'] }],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      }
    };
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: dueAtMs }));
    const loadBriefing = vi.fn(async () => null);
    const generateBriefing = vi.fn(async () => invalidBriefing);
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        members,
        recipientUserIds: ['user_123'],
        attempts: [],
        lastSyncedAt: dueAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).rejects.toThrow('Morning briefing is not valid stored briefing content');

    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordDeliveryAttempt).not.toHaveBeenCalled();
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
        members,
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
        members,
        recipientUserIds: ['user_done', 'user_retry'],
        attempts: [
          { briefingKey: `${briefing.briefingKey}:morning`, recipientUserId: 'user_done', status: 'sent' },
          { briefingKey: `${briefing.briefingKey}:morning`, recipientUserId: 'user_retry', status: 'failed' }
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
      message: `Library bag and dancing pickup.

This morning:
- Child A: Bring library bag.`,
      metadata: {
        briefingKey: briefing.briefingKey,
        deliveryKey: `${briefing.briefingKey}:morning`,
        deliverySlot: 'morning',
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });
  });

  it('treats legacy base-key attempts as completed for the morning slot only', async () => {
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: dueAtMs }));
    const loadBriefing = vi.fn(async () => briefing);
    const generateBriefing = vi.fn();
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: dueAtMs,
        timeZone,
        members,
        recipientUserIds: ['user_done'],
        attempts: [{ briefingKey: briefing.briefingKey, recipientUserId: 'user_done', status: 'sent' }],
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
    expect(recordDeliveryAttempt).not.toHaveBeenCalled();
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
        members,
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
      message: `Library bag and dancing pickup.

This morning:
- Child A: Bring library bag.
Note: schedule data may be stale because the latest calendar sync failed.`,
      metadata: {
        briefingKey: briefing.briefingKey,
        deliveryKey: `${briefing.briefingKey}:morning`,
        deliverySlot: 'morning',
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
        members,
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
      message: `Library bag and dancing pickup.

This morning:
- Child A: Bring library bag.`,
      metadata: {
        briefingKey: briefing.briefingKey,
        deliveryKey: `${briefing.briefingKey}:morning`,
        deliverySlot: 'morning',
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
        members,
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
        members,
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
      briefingKey: `${suppressedBriefing.briefingKey}:morning`,
      recipientUserId: 'user_123',
      attemptedAt: dueAtMs,
      status: 'pending'
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: `${suppressedBriefing.briefingKey}:morning`,
      recipientUserId: 'user_123',
      attemptedAt: dueAtMs,
      status: 'skipped'
    });
  });

  it('skips the afternoon slot when weather is ready but the briefing has no afternoon content', async () => {
    const afternoonDueAtMs = Date.parse('2026-06-13T04:30:00.000Z'); // 2:30pm in Sydney
    const structuredBriefing = briefing.briefing;
    if (!structuredBriefing) throw new Error('Test fixture should include structured briefing content');
    const morningOnlyBriefing: BotMorningBriefing = {
      ...briefing,
      briefing: {
        ...structuredBriefing,
        afternoon: []
      }
    };
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: afternoonDueAtMs }));
    const loadBriefing = vi.fn(async () => morningOnlyBriefing);
    const generateBriefing = vi.fn(async () => morningOnlyBriefing);
    const loadWeather = vi.fn(async () => ({
      summary: 'Wet afternoon.',
      morning: {
        temperatureC: { min: 12, max: 18 },
        apparentTemperatureC: { min: 12, max: 18 },
        relativeHumidityPercent: { min: 58, max: 62 },
        rainChancePercent: 10,
        maxWindGustKph: 10,
        maxUvIndex: 2,
        readiness: []
      },
      afternoon: {
        temperatureC: { min: 17, max: 21 },
        apparentTemperatureC: { min: 16, max: 20 },
        relativeHumidityPercent: { min: 70, max: 74 },
        rainChancePercent: 80,
        maxWindGustKph: 12,
        maxUvIndex: 3,
        readiness: ['rain layer']
      }
    }));
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: afternoonDueAtMs,
        timeZone,
        members,
        recipientUserIds: ['user_123'],
        attempts: [
          { briefingKey: `${briefing.briefingKey}:morning`, recipientUserId: 'user_123', status: 'sent' },
          { briefingKey: `${briefing.briefingKey}:afternoon`, recipientUserId: 'user_123', status: 'failed' }
        ],
        lastSyncedAt: afternoonDueAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        loadWeather,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toMatchObject({
      processed: 1,
      sent: 0,
      skipped: 1,
      failed: 0
    });

    expect(generateBriefing).toHaveBeenCalledWith({
      localDate: '2026-06-13',
      timeZone,
      generatedAt: afternoonDueAtMs,
      replaceExisting: true
    });
    expect(loadWeather).toHaveBeenCalledWith({ localDate: '2026-06-13', timeZone });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: `${briefing.briefingKey}:afternoon`,
      recipientUserId: 'user_123',
      attemptedAt: afternoonDueAtMs,
      status: 'pending'
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: `${briefing.briefingKey}:afternoon`,
      recipientUserId: 'user_123',
      attemptedAt: afternoonDueAtMs,
      status: 'skipped'
    });
  });

  it('regenerates the stored briefing for the afternoon slot after a successful schedule sync', async () => {
    const afternoonDueAtMs = Date.parse('2026-06-13T04:30:00.000Z'); // 2:30pm in Sydney
    const refreshedBriefing: BotMorningBriefing = {
      ...briefing,
      message: 'Today:\nLibrary bag only.',
      briefing: {
        shouldSend: true,
        headline: 'Library bag only.',
        morning: [{ text: 'Bring library bag.', who: ['childA'], sourceIds: ['req:library:1'] }],
        afternoon: [],
        watchouts: [],
        sourceIdsIgnored: []
      }
    };
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: afternoonDueAtMs }));
    const loadBriefing = vi.fn(async () => briefing);
    const generateBriefing = vi.fn(async () => refreshedBriefing);
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: afternoonDueAtMs,
        timeZone,
        members,
        recipientUserIds: ['user_123'],
        attempts: [
          { briefingKey: `${briefing.briefingKey}:morning`, recipientUserId: 'user_123', status: 'sent' },
          { briefingKey: `${briefing.briefingKey}:afternoon`, recipientUserId: 'user_123', status: 'failed' }
        ],
        lastSyncedAt: afternoonDueAtMs,
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
      generated: true
    });

    expect(loadBriefing).toHaveBeenCalledWith({ localDate: '2026-06-13' });
    expect(generateBriefing).toHaveBeenCalledWith({
      localDate: '2026-06-13',
      timeZone,
      generatedAt: afternoonDueAtMs,
      replaceExisting: true
    });
    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: `${briefing.briefingKey}:afternoon`,
      recipientUserId: 'user_123',
      attemptedAt: afternoonDueAtMs,
      status: 'skipped'
    });
  });

  it('does not refresh the afternoon briefing when every recipient already completed the afternoon slot', async () => {
    const afternoonRetryAtMs = Date.parse('2026-06-13T04:40:00.000Z'); // 2:40pm in Sydney
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: afternoonRetryAtMs }));
    const loadBriefing = vi.fn(async () => briefing);
    const generateBriefing = vi.fn(async () => briefing);
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: afternoonRetryAtMs,
        timeZone,
        members,
        recipientUserIds: ['user_done'],
        attempts: [{ briefingKey: `${briefing.briefingKey}:afternoon`, recipientUserId: 'user_done', status: 'sent' }],
        lastSyncedAt: afternoonRetryAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toMatchObject({
      processed: 0,
      sent: 0,
      skipped: 0,
      generated: false
    });

    expect(syncSchedule).not.toHaveBeenCalled();
    expect(loadBriefing).not.toHaveBeenCalled();
    expect(generateBriefing).not.toHaveBeenCalled();
    expect(sendNotification).not.toHaveBeenCalled();
    expect(recordDeliveryAttempt).not.toHaveBeenCalled();
  });

  it('sends the afternoon slot at 2:30pm with refreshed afternoon weather', async () => {
    const afternoonDueAtMs = Date.parse('2026-06-13T04:30:00.000Z'); // 2:30pm in Sydney
    const syncSchedule = vi.fn(async () => ({ ok: true as const, lastSyncedAt: afternoonDueAtMs }));
    const loadBriefing = vi.fn(async () => briefing);
    const generateBriefing = vi.fn(async () => briefing);
    const loadWeather = vi.fn(async () => ({
      summary: 'Wet afternoon.',
      morning: {
        temperatureC: { min: 12, max: 18 },
        apparentTemperatureC: { min: 12, max: 18 },
        relativeHumidityPercent: { min: 58, max: 62 },
        rainChancePercent: 10,
        maxWindGustKph: 10,
        maxUvIndex: 2,
        readiness: []
      },
      afternoon: {
        temperatureC: { min: 17, max: 21 },
        apparentTemperatureC: { min: 16, max: 20 },
        relativeHumidityPercent: { min: 70, max: 74 },
        rainChancePercent: 80,
        maxWindGustKph: 12,
        maxUvIndex: 3,
        readiness: ['rain layer']
      }
    }));
    const sendNotification = vi.fn(async () => ({ status: 'sent' as const }));
    const recordDeliveryAttempt = vi.fn(async () => ({ claimed: true as const }));

    await expect(
      runMorningBriefingDeliveryCycle({
        nowMs: afternoonDueAtMs,
        timeZone,
        members,
        recipientUserIds: ['user_123'],
        attempts: [{ briefingKey: `${briefing.briefingKey}:morning`, recipientUserId: 'user_123', status: 'sent' }],
        lastSyncedAt: afternoonDueAtMs,
        syncSchedule,
        loadBriefing,
        generateBriefing,
        loadWeather,
        sendNotification,
        recordDeliveryAttempt
      })
    ).resolves.toMatchObject({
      processed: 1,
      sent: 1,
      generated: true
    });

    expect(generateBriefing).toHaveBeenCalledWith({
      localDate: '2026-06-13',
      timeZone,
      generatedAt: afternoonDueAtMs,
      replaceExisting: true
    });
    expect(loadWeather).toHaveBeenCalledWith({ localDate: '2026-06-13', timeZone });
    expect(sendNotification).toHaveBeenCalledWith({
      recipientUserId: 'user_123',
      topic: 'briefing.morning',
      message: `This afternoon:
- Child A: Bring dancing shoes.

Weather:
- Rain layer may help this afternoon.`,
      metadata: {
        briefingKey: briefing.briefingKey,
        deliveryKey: `${briefing.briefingKey}:afternoon`,
        deliverySlot: 'afternoon',
        localDate: briefing.localDate,
        generationStatus: briefing.generationStatus
      }
    });
    expect(recordDeliveryAttempt).toHaveBeenCalledWith({
      briefingKey: `${briefing.briefingKey}:afternoon`,
      recipientUserId: 'user_123',
      attemptedAt: afternoonDueAtMs,
      status: 'pending'
    });
  });
});
