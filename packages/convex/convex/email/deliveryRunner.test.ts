import { describe, expect, it } from 'vitest';

import { emailReminderRecipientUserIdsFromEnv } from './deliveryRunner';

describe('emailReminderRecipientUserIdsFromEnv', () => {
  it('reads the notice-specific recipient list without using morning briefing config', () => {
    expect(
      emailReminderRecipientUserIdsFromEnv({
        FORWARDED_EMAIL_NOTICE_RECIPIENT_USER_IDS: 'notice-user-1, notice-user-2'
      })
    ).toEqual(['notice-user-1', 'notice-user-2']);
  });

  it('treats a missing notice-specific recipient list as no recipients', () => {
    expect(emailReminderRecipientUserIdsFromEnv({})).toEqual([]);
  });
});
