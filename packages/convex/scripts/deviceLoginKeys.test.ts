import { describe, expect, it } from 'vitest';

import { createKeyPair, nextJwks } from './deviceLoginKeys';

describe('device login key script', () => {
  it('publishes only the public half of a new key', async () => {
    const pair = await createKeyPair(new Date('2026-01-02T00:00:00Z'));

    expect(pair.kid).toMatch(/^device-2026-01-02-[0-9a-f]{8}$/);
    expect(JSON.parse(pair.privateJwk)).toMatchObject({ kid: pair.kid, d: expect.any(String) });
    expect(pair.publicJwk).not.toHaveProperty('d');
    expect(JSON.parse(nextJwks(undefined, undefined, pair.publicJwk))).toEqual({ keys: [pair.publicJwk] });
  });

  it('keeps the signing key and drops older ones when rotating', async () => {
    const [older, current, next] = await Promise.all([createKeyPair(), createKeyPair(), createKeyPair()]);
    const published = JSON.stringify({ keys: [older.publicJwk, current.publicJwk] });

    const rotated = JSON.parse(nextJwks(published, current.kid, next.publicJwk)) as { keys: Array<{ kid: string }> };

    expect(rotated.keys.map((key) => key.kid)).toEqual([current.kid, next.kid]);
  });
});
