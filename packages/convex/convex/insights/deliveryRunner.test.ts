import { describe, expect, it } from 'vitest';

import { spendingInsightDeliveryConfigFromEnv } from './deliveryRunner';

describe('spendingInsightDeliveryConfigFromEnv', () => {
  it('reads the insight-specific recipient list without using morning briefing config', () => {
    expect(
      spendingInsightDeliveryConfigFromEnv({
        BOT_SERVICE_TOKEN: 'service-token',
        BOT_GATEWAY_ORIGIN: 'https://bot.example.com',
        SPENDING_INSIGHT_RECIPIENT_USER_IDS: 'insight-user-1, insight-user-2'
      })
    ).toEqual({
      ok: true,
      serviceToken: 'service-token',
      botGatewayOrigin: 'https://bot.example.com',
      recipientUserIds: ['insight-user-1', 'insight-user-2']
    });
  });

  it('treats a missing insight-specific recipient list as no recipients', () => {
    expect(
      spendingInsightDeliveryConfigFromEnv({
        BOT_SERVICE_TOKEN: 'service-token',
        BOT_GATEWAY_ORIGIN: 'https://bot.example.com'
      })
    ).toEqual({
      ok: true,
      serviceToken: 'service-token',
      botGatewayOrigin: 'https://bot.example.com',
      recipientUserIds: []
    });
  });

  it('reports missing bot service token instead of throwing', () => {
    expect(
      spendingInsightDeliveryConfigFromEnv({
        BOT_GATEWAY_ORIGIN: 'https://bot.example.com',
        SPENDING_INSIGHT_RECIPIENT_USER_IDS: 'insight-user-1'
      })
    ).toEqual({ ok: false, reason: 'missing_bot_service_token' });
  });

  it('reports missing bot gateway origin instead of throwing', () => {
    expect(
      spendingInsightDeliveryConfigFromEnv({
        BOT_SERVICE_TOKEN: 'service-token',
        SPENDING_INSIGHT_RECIPIENT_USER_IDS: 'insight-user-1'
      })
    ).toEqual({ ok: false, reason: 'missing_bot_gateway_origin' });
  });
});
