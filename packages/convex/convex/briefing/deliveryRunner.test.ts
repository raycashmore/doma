import { describe, expect, it } from 'vitest';

import { botMorningBriefingFromStoreResult } from './botBriefing';

describe('botMorningBriefingFromStoreResult', () => {
  it('flattens a stored generated briefing result into a bot briefing', () => {
    expect(
      botMorningBriefingFromStoreResult({
        inserted: true,
        id: 'briefing_doc_123',
        briefing: {
          briefingKey: 'morning:2026-06-13',
          localDate: '2026-06-13',
          generationStatus: 'fallback',
          message: 'Morning briefing\nPack / bring\n- memberA: Bring library bag.',
          briefing: {
            shouldSend: true
          }
        }
      })
    ).toEqual({
      briefingKey: 'morning:2026-06-13',
      localDate: '2026-06-13',
      generationStatus: 'fallback',
      shouldSend: true,
      message: 'Morning briefing\nPack / bring\n- memberA: Bring library bag.'
    });
  });
});
