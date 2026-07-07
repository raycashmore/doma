import { describe, expect, it } from 'vitest';

import { spendingInsightDeliveryConfigFromEnv } from './deliveryRunner';

describe('spendingInsightDeliveryConfigFromEnv', () => {
  it('reads the household briefing recipients and bot gateway config', () => {
    expect(
      spendingInsightDeliveryConfigFromEnv({
        BOT_SERVICE_TOKEN: 'service-token',
        BOT_GATEWAY_ORIGIN: 'https://bot.example.com',
        MORNING_BRIEFING_RECIPIENT_USER_IDS: 'household-user-1, household-user-2'
      })
    ).toEqual({
      ok: true,
      serviceToken: 'service-token',
      botGatewayOrigin: 'https://bot.example.com',
      recipientUserIds: ['household-user-1', 'household-user-2']
    });
  });

  it('reports missing bot service token instead of throwing', () => {
    expect(
      spendingInsightDeliveryConfigFromEnv({
        BOT_GATEWAY_ORIGIN: 'https://bot.example.com',
        MORNING_BRIEFING_RECIPIENT_USER_IDS: 'household-user-1'
      })
    ).toEqual({ ok: false, reason: 'missing_bot_service_token' });
  });

  it('reports missing bot gateway origin instead of throwing', () => {
    expect(
      spendingInsightDeliveryConfigFromEnv({
        BOT_SERVICE_TOKEN: 'service-token',
        MORNING_BRIEFING_RECIPIENT_USER_IDS: 'household-user-1'
      })
    ).toEqual({ ok: false, reason: 'missing_bot_gateway_origin' });
  });
});
