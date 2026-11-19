import type { FunctionReference } from 'convex/server';
import { v } from 'convex/values';

import { internal } from '../_generated/api';
import type { Id } from '../_generated/dataModel';
import {
  action,
  type ActionCtx,
  internalMutation,
  internalQuery,
  mutation,
  type MutationCtx,
  type QueryCtx
} from '../_generated/server';
import {
  checkClerkUser,
  createDeviceSecret,
  deviceInactivityLimitMs,
  DeviceLoginSetupError,
  hashDeviceSecret,
  importDeviceSigningKey,
  isInactive,
  isWellFormedDeviceSecret,
  signDeviceToken
} from './model';

// Secret material never reaches a log, an error or a return value here, apart from the one-time
// return of a new secret from `link`. See "Device login secrets" in docs/agents/privacy.md.

const maxLabelLength = 40;

type DeviceRefs = {
  insertDevice: FunctionReference<
    'mutation',
    'internal',
    { userId: string; label: string; tokenHash: string; now: number },
    Id<'devices'>
  >;
  findDevice: FunctionReference<
    'query',
    'internal',
    { tokenHash: string },
    { deviceId: Id<'devices'>; userId: string; lastUsedAt: number } | null
  >;
  recordUse: FunctionReference<
    'mutation',
    'internal',
    { deviceId: Id<'devices'>; tokenHash: string; now: number },
    boolean
  >;
  deleteDevice: FunctionReference<'mutation', 'internal', { deviceId: Id<'devices'> }, null>;
};

const deviceRefs: DeviceRefs = (internal as unknown as { devices: { login: DeviceRefs } }).devices.login;

// ============================================================
// LINK — a Clerk sign-in becomes a device login
// ============================================================

export async function linkHandler(
  ctx: Pick<ActionCtx, 'auth' | 'runMutation'>,
  { label }: { label: string },
  options: { deviceIssuer: string | undefined; now: number }
) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  // auth.config.ts accepts only Clerk and device tokens, so refusing device tokens leaves Clerk
  // sign-ins: a device login cannot copy itself past its own revocation.
  if (!options.deviceIssuer) throw new DeviceLoginSetupError('CONVEX_SITE_URL is missing');
  if (withoutTrailingSlash(identity.issuer) === withoutTrailingSlash(options.deviceIssuer)) {
    throw new Error('A device can only be linked from a Clerk sign-in');
  }
  const secret = createDeviceSecret();
  const deviceId = await ctx.runMutation(deviceRefs.insertDevice, {
    userId: identity.subject,
    label: label.trim().slice(0, maxLabelLength) || 'Device',
    tokenHash: await hashDeviceSecret(secret),
    now: options.now
  });
  return { deviceId, secret };
}

function withoutTrailingSlash(url: string) {
  return url.replace(/\/+$/, '');
}

/** Links this device to the signed-in Clerk user. The secret is returned here once and never again. */
export const link = action({
  args: { label: v.string() },
  returns: v.object({ deviceId: v.id('devices'), secret: v.string() }),
  handler: (ctx, args) => linkHandler(ctx, args, { deviceIssuer: process.env.CONVEX_SITE_URL, now: Date.now() })
});

export const insertDevice = internalMutation({
  args: { userId: v.string(), label: v.string(), tokenHash: v.string(), now: v.number() },
  returns: v.id('devices'),
  handler: (ctx, { userId, label, tokenHash, now }) =>
    ctx.db.insert('devices', { userId, label, tokenHash, createdAt: now, lastUsedAt: now })
});

// ============================================================
// EXCHANGE — a device secret becomes a short-lived Convex token
// ============================================================

export type ExchangeResult = { status: 'issued'; token: string; expiresAt: number } | { status: 'rejected' };

export type ExchangeOptions = {
  now: number;
  issuer: string | undefined;
  privateJwk: string | undefined;
  publicJwks: string | undefined;
  clerkSecretKey: string | undefined;
  fetch?: typeof fetch;
};

function reject(reason: string): ExchangeResult {
  console.info(`Device token refused: ${reason}`);
  return { status: 'rejected' };
}

export async function exchangeHandler(
  ctx: Pick<ActionCtx, 'runQuery' | 'runMutation'>,
  { secret }: { secret: string },
  options: ExchangeOptions
): Promise<ExchangeResult> {
  // Configuration first, so a broken deployment fails loudly before touching any device.
  if (!options.issuer) throw new DeviceLoginSetupError('CONVEX_SITE_URL is missing');
  const signingKey = await importDeviceSigningKey(options.privateJwk, options.publicJwks);

  if (!isWellFormedDeviceSecret(secret)) return reject('malformed secret');
  const tokenHash = await hashDeviceSecret(secret);
  const device = await ctx.runQuery(deviceRefs.findDevice, { tokenHash });
  if (!device) return reject('unknown device');
  if (isInactive(device.lastUsedAt, options.now)) {
    await ctx.runMutation(deviceRefs.deleteDevice, { deviceId: device.deviceId });
    return reject('unused for 60 days');
  }

  const clerkStatus = await checkClerkUser(device.userId, options.clerkSecretKey, options.fetch);
  if (clerkStatus === 'gone') {
    await ctx.runMutation(deviceRefs.deleteDevice, { deviceId: device.deviceId });
    return reject('Clerk user deleted or banned');
  }
  if (clerkStatus === 'unknown') console.warn('Device token issued without a Clerk check: Clerk unreachable');

  // Re-checked in the mutation, so a device revoked during the Clerk call gets no token.
  const stillLinked = await ctx.runMutation(deviceRefs.recordUse, {
    deviceId: device.deviceId,
    tokenHash,
    now: options.now
  });
  if (!stillLinked) return reject('revoked during the swap');

  const { token, expiresAt } = await signDeviceToken(signingKey, {
    issuer: options.issuer,
    userId: device.userId,
    now: options.now
  });
  return { status: 'issued', token, expiresAt };
}

/**
 * Swaps a device secret for a token that lasts an hour. Public, because the device has no other
 * credential: a 256-bit secret cannot be guessed. `rejected` means the device login is gone and the
 * device must sign in again; a thrown error is a setup or server fault the device should retry.
 */
export const exchange = action({
  args: { secret: v.string() },
  returns: v.union(
    v.object({ status: v.literal('issued'), token: v.string(), expiresAt: v.number() }),
    v.object({ status: v.literal('rejected') })
  ),
  handler: (ctx, args) =>
    exchangeHandler(ctx, args, {
      now: Date.now(),
      issuer: process.env.CONVEX_SITE_URL,
      privateJwk: process.env.DEVICE_JWT_PRIVATE_KEY,
      publicJwks: process.env.DEVICE_JWT_JWKS,
      clerkSecretKey: process.env.CLERK_SECRET_KEY
    })
});

export async function findDeviceHandler(ctx: Pick<QueryCtx, 'db'>, { tokenHash }: { tokenHash: string }) {
  const device = await ctx.db
    .query('devices')
    .withIndex('by_token_hash', (q) => q.eq('tokenHash', tokenHash))
    .unique();
  return device ? { deviceId: device._id, userId: device.userId, lastUsedAt: device.lastUsedAt } : null;
}

export const findDevice = internalQuery({
  args: { tokenHash: v.string() },
  returns: v.union(v.object({ deviceId: v.id('devices'), userId: v.string(), lastUsedAt: v.number() }), v.null()),
  handler: findDeviceHandler
});

export async function recordUseHandler(
  ctx: Pick<MutationCtx, 'db'>,
  { deviceId, tokenHash, now }: { deviceId: Id<'devices'>; tokenHash: string; now: number }
) {
  const device = await ctx.db.get(deviceId);
  if (!device || device.tokenHash !== tokenHash) return false;
  if (isInactive(device.lastUsedAt, now)) {
    await ctx.db.delete(deviceId);
    return false;
  }
  await ctx.db.patch(deviceId, { lastUsedAt: now });
  return true;
}

export const recordUse = internalMutation({
  args: { deviceId: v.id('devices'), tokenHash: v.string(), now: v.number() },
  returns: v.boolean(),
  handler: recordUseHandler
});

export const deleteDevice = internalMutation({
  args: { deviceId: v.id('devices') },
  returns: v.null(),
  handler: async (ctx, { deviceId }) => {
    if (await ctx.db.get(deviceId)) await ctx.db.delete(deviceId);
    return null;
  }
});

// ============================================================
// REVOKE AND CLEAN UP
// ============================================================

export async function revokeHandler(ctx: Pick<MutationCtx, 'auth' | 'db'>, { deviceId }: { deviceId: Id<'devices'> }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  const device = await ctx.db.get(deviceId);
  // Another person's device is left alone, without saying whether it exists.
  if (device?.userId === identity.subject) await ctx.db.delete(deviceId);
}

/** Signs a device out on the server. Accepts a Clerk or a device token. */
export const revoke = mutation({
  args: { deviceId: v.id('devices') },
  returns: v.null(),
  handler: async (ctx, args) => {
    await revokeHandler(ctx, args);
    return null;
  }
});

export async function deleteInactiveDevicesHandler(ctx: Pick<MutationCtx, 'db'>, now = Date.now()) {
  const inactive = await ctx.db
    .query('devices')
    .withIndex('by_last_used_at', (q) => q.lt('lastUsedAt', now - deviceInactivityLimitMs))
    .take(100);
  for (const device of inactive) await ctx.db.delete(device._id);
  return inactive.length;
}

/** Daily: devices that went quiet are deleted even if they never ask for a token again. */
export const deleteInactiveDevices = internalMutation({
  args: {},
  returns: v.number(),
  handler: (ctx) => deleteInactiveDevicesHandler(ctx)
});
