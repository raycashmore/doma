import { beforeAll, describe, expect, it, vi } from 'vitest';

import type { Id } from '../_generated/dataModel';
import type { ActionCtx } from '../_generated/server';
import {
  deleteInactiveDevicesHandler,
  exchangeHandler,
  type ExchangeOptions,
  findDeviceHandler,
  linkHandler,
  recordUseHandler,
  revokeHandler
} from './login';
import { deviceInactivityLimitMs, DeviceLoginSetupError } from './model';

// Throwaway keys made for each run; nothing here is real or reusable key material.
const clerkIssuer = 'https://clerk.example.test';
const siteUrl = 'https://deployment.example.test';
const fakeClerkKey = 'sk_test_fake_key_for_tests_only';
const day = 24 * 60 * 60 * 1000;
const start = 1_800_000_000_000;

let keys: { privateJwk: string; publicJwks: string; verifyKey: CryptoKey };

beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const kid = 'test-only-key';
  const privateJwk = { ...(await crypto.subtle.exportKey('jwk', pair.privateKey)), kid };
  const publicJwk = { ...(await crypto.subtle.exportKey('jwk', pair.publicKey)), kid, alg: 'ES256', use: 'sig' };
  keys = {
    privateJwk: JSON.stringify(privateJwk),
    publicJwks: JSON.stringify({ keys: [publicJwk] }),
    verifyKey: pair.publicKey
  };
});

type DeviceRow = {
  _id: Id<'devices'>;
  userId: string;
  label: string;
  tokenHash: string;
  createdAt: number;
  lastUsedAt: number;
};

/** An in-memory `devices` table with the actual handlers behind runQuery and runMutation. */
function createBackend() {
  const devices = new Map<string, DeviceRow>();
  let nextId = 0;
  const db = {
    get: async (id: string) => devices.get(id) ?? null,
    insert: async (_table: 'devices', row: Omit<DeviceRow, '_id'>) => {
      const id = `device_${++nextId}` as Id<'devices'>;
      devices.set(id, { ...row, _id: id });
      return id;
    },
    patch: async (id: string, patch: Partial<DeviceRow>) => {
      const row = devices.get(id);
      if (row) devices.set(id, { ...row, ...patch });
    },
    delete: async (id: string) => {
      devices.delete(id);
    },
    query: () => ({
      withIndex: (index: string, apply: (q: unknown) => unknown) => {
        let field = '';
        let value = 0 as string | number;
        let comparison: 'eq' | 'lt' = 'eq';
        apply({
          eq: (f: string, v: string) => ((field = f), (value = v), (comparison = 'eq')),
          lt: (f: string, v: number) => ((field = f), (value = v), (comparison = 'lt'))
        });
        expect(['by_token_hash', 'by_last_used_at']).toContain(index);
        const matches = () =>
          [...devices.values()].filter((row) => {
            const actual = row[field as keyof DeviceRow];
            return comparison === 'eq' ? actual === value : (actual as number) < (value as number);
          });
        return {
          unique: async () => matches()[0] ?? null,
          take: async (count: number) => matches().slice(0, count)
        };
      }
    })
  };
  type Args = Record<string, unknown>;
  const ctx = {
    runQuery: async (_ref: unknown, args: Args) => findDeviceHandler({ db } as never, args as { tokenHash: string }),
    runMutation: async (_ref: unknown, args: Args) => {
      if ('userId' in args) {
        const { userId, label, tokenHash, now } = args as {
          userId: string;
          label: string;
          tokenHash: string;
          now: number;
        };
        return db.insert('devices', { userId, label, tokenHash, createdAt: now, lastUsedAt: now });
      }
      if ('tokenHash' in args) return recordUseHandler({ db } as never, args as never);
      await db.delete(args.deviceId as string);
      return null;
    }
  } as unknown as Pick<ActionCtx, 'runQuery' | 'runMutation'>;
  const asUser = (subject: string, issuer = clerkIssuer) => ({
    auth: { getUserIdentity: async () => ({ subject, issuer, tokenIdentifier: `${issuer}|${subject}` }) }
  });
  return { devices, db, ctx, asUser };
}

function clerkAnswers(status: number, body: object = { id: 'user_a', banned: false }) {
  return vi.fn(async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;
}

function exchangeOptions(overrides: Partial<ExchangeOptions> = {}): ExchangeOptions {
  return {
    now: start,
    issuer: siteUrl,
    privateJwk: keys.privateJwk,
    publicJwks: keys.publicJwks,
    clerkSecretKey: fakeClerkKey,
    fetch: clerkAnswers(200),
    ...overrides
  };
}

async function linkDevice(backend: ReturnType<typeof createBackend>, userId = 'user_a') {
  return linkHandler({ ...backend.ctx, ...backend.asUser(userId) }, { label: 'iPad' }, { clerkIssuer, now: start });
}

function decodePart(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as Record<string, unknown>;
}

describe('device login link', () => {
  it('returns the secret once and stores only its hash', async () => {
    const backend = createBackend();
    const { deviceId, secret } = await linkDevice(backend);

    const row = backend.devices.get(deviceId);
    expect(row).toMatchObject({ userId: 'user_a', label: 'iPad', createdAt: start, lastUsedAt: start });
    expect(secret).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(JSON.stringify(row)).not.toContain(secret);
  });

  it('refuses anyone not signed in with Clerk, including a device token', async () => {
    const backend = createBackend();
    const signedOut = { ...backend.ctx, auth: { getUserIdentity: async () => null } };

    await expect(linkHandler(signedOut, { label: 'iPad' }, { clerkIssuer, now: start })).rejects.toThrow(
      'Not authenticated'
    );
    await expect(
      linkHandler(
        { ...backend.ctx, ...backend.asUser('user_a', siteUrl) },
        { label: 'iPad' },
        { clerkIssuer, now: start }
      )
    ).rejects.toThrow('Clerk sign-in');
    expect(backend.devices.size).toBe(0);
  });
});

describe('device token exchange', () => {
  it('issues an hour-long ES256 token for the linked user that verifies against the public keys', async () => {
    const backend = createBackend();
    const { deviceId, secret } = await linkDevice(backend);
    const later = start + day;

    const result = await exchangeHandler(backend.ctx, { secret }, exchangeOptions({ now: later }));

    if (result.status !== 'issued') throw new Error('expected a token');
    const [header, payload, signature] = result.token.split('.');
    expect(decodePart(header!)).toEqual({ alg: 'ES256', typ: 'JWT', kid: 'test-only-key' });
    expect(decodePart(payload!)).toEqual({
      iss: siteUrl,
      sub: 'user_a',
      aud: 'convex',
      iat: later / 1000,
      exp: later / 1000 + 3600
    });
    expect(result.expiresAt).toBe(later + 3600 * 1000);
    const verified = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' },
      keys.verifyKey,
      Buffer.from(signature!, 'base64url'),
      new TextEncoder().encode(`${header}.${payload}`)
    );
    expect(verified).toBe(true);
    expect(backend.devices.get(deviceId)?.lastUsedAt).toBe(later);
  });

  it('rejects an unknown or malformed secret', async () => {
    const backend = createBackend();
    await linkDevice(backend);

    await expect(exchangeHandler(backend.ctx, { secret: 'A'.repeat(43) }, exchangeOptions())).resolves.toEqual({
      status: 'rejected'
    });
    await expect(exchangeHandler(backend.ctx, { secret: 'not a secret' }, exchangeOptions())).resolves.toEqual({
      status: 'rejected'
    });
  });

  it('rejects and deletes a device unused for 60 days', async () => {
    const backend = createBackend();
    const { deviceId, secret } = await linkDevice(backend);

    const result = await exchangeHandler(
      backend.ctx,
      { secret },
      exchangeOptions({ now: start + deviceInactivityLimitMs + 1 })
    );

    expect(result).toEqual({ status: 'rejected' });
    expect(backend.devices.has(deviceId)).toBe(false);
  });

  it('keeps a device used within 60 days', async () => {
    const backend = createBackend();
    const { secret } = await linkDevice(backend);

    const result = await exchangeHandler(
      backend.ctx,
      { secret },
      exchangeOptions({ now: start + deviceInactivityLimitMs })
    );

    expect(result.status).toBe('issued');
  });

  it.each([
    ['deleted', clerkAnswers(404, { errors: [] })],
    ['banned', clerkAnswers(200, { id: 'user_a', banned: true })]
  ])('rejects and deletes the device when the Clerk user is %s', async (_case, clerk) => {
    const backend = createBackend();
    const { deviceId, secret } = await linkDevice(backend);

    const result = await exchangeHandler(backend.ctx, { secret }, exchangeOptions({ fetch: clerk }));

    expect(result).toEqual({ status: 'rejected' });
    expect(backend.devices.has(deviceId)).toBe(false);
    expect(clerk).toHaveBeenCalledWith(
      'https://api.clerk.com/v1/users/user_a',
      expect.objectContaining({ headers: { Authorization: `Bearer ${fakeClerkKey}` } })
    );
  });

  it.each([
    ['unreachable', vi.fn(async () => Promise.reject(new TypeError('fetch failed'))) as unknown as typeof fetch],
    ['failing', clerkAnswers(503, {})],
    ['rate limiting', clerkAnswers(429, {})]
  ])('still issues a token when Clerk is %s', async (_case, clerk) => {
    const backend = createBackend();
    const { secret } = await linkDevice(backend);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await exchangeHandler(backend.ctx, { secret }, exchangeOptions({ fetch: clerk }));

    expect(result.status).toBe('issued');
  });

  it('rejects a revoked device, including one revoked while Clerk was checked', async () => {
    const backend = createBackend();
    const first = await linkDevice(backend);
    await revokeHandler({ ...backend.asUser('user_a'), db: backend.db } as never, { deviceId: first.deviceId });
    await expect(exchangeHandler(backend.ctx, { secret: first.secret }, exchangeOptions())).resolves.toEqual({
      status: 'rejected'
    });

    const second = await linkDevice(backend);
    const revokingClerk = vi.fn(async () => {
      backend.devices.delete(second.deviceId);
      return new Response(JSON.stringify({ banned: false }), { status: 200 });
    }) as unknown as typeof fetch;
    await expect(
      exchangeHandler(backend.ctx, { secret: second.secret }, exchangeOptions({ fetch: revokingClerk }))
    ).resolves.toEqual({ status: 'rejected' });
  });

  it.each([
    ['the private key is missing', { privateJwk: undefined }],
    ['the public keys lack the signing key', { publicJwks: JSON.stringify({ keys: [{ kid: 'other' }] }) }],
    ['the site URL is missing', { issuer: undefined }],
    ['the Clerk secret key is missing', { clerkSecretKey: undefined }],
    ['Clerk rejects its secret key', { fetch: clerkAnswers(401, {}) }]
  ])('fails loudly, without echoing any value, when %s', async (_case, overrides) => {
    const backend = createBackend();
    const { deviceId, secret } = await linkDevice(backend);

    const failure = await exchangeHandler(backend.ctx, { secret }, exchangeOptions(overrides)).catch(
      (error: unknown) => error
    );

    expect(failure).toBeInstanceOf(DeviceLoginSetupError);
    const message = (failure as Error).message;
    for (const value of [secret, fakeClerkKey, keys.privateJwk]) expect(message).not.toContain(value);
    expect(backend.devices.get(deviceId)?.lastUsedAt).toBe(start);
  });
});

describe('device revoke and clean-up', () => {
  it('lets only the owner revoke a device', async () => {
    const backend = createBackend();
    const { deviceId } = await linkDevice(backend);

    await revokeHandler({ ...backend.asUser('user_b'), db: backend.db } as never, { deviceId });
    expect(backend.devices.has(deviceId)).toBe(true);

    await revokeHandler({ ...backend.asUser('user_a', siteUrl), db: backend.db } as never, { deviceId });
    expect(backend.devices.has(deviceId)).toBe(false);
  });

  it('deletes only devices unused for 60 days', async () => {
    const backend = createBackend();
    const old = await linkDevice(backend);
    const recent = await linkDevice(backend);
    await backend.db.patch(recent.deviceId, { lastUsedAt: start + 30 * day });

    const deleted = await deleteInactiveDevicesHandler(
      { db: backend.db } as never,
      start + deviceInactivityLimitMs + day
    );

    expect(deleted).toBe(1);
    expect(backend.devices.has(old.deviceId)).toBe(false);
    expect(backend.devices.has(recent.deviceId)).toBe(true);
  });
});
