import { paginationOptsValidator, paginationResultValidator } from 'convex/server';
import { v } from 'convex/values';

import { internalMutation, internalQuery, mutation } from '../_generated/server';
import { type ListsMutationCtx, requireUserId } from './items';

const registeredDevice = v.object({
  id: v.id('androidWidgetDevices'),
  fcmToken: v.string()
});

function requireRegistrationValue(value: string, name: string) {
  if (!value.trim()) throw new Error(`${name} is required`);
}

export async function registerWidgetDeviceHandler(
  ctx: ListsMutationCtx,
  args: { installationId: string; fcmToken: string }
) {
  requireRegistrationValue(args.installationId, 'Installation ID');
  requireRegistrationValue(args.fcmToken, 'FCM token');
  const userId = await requireUserId(ctx);
  const existing = await ctx.db
    .query('androidWidgetDevices')
    .withIndex('by_user_id_and_installation_id', (q) =>
      q.eq('userId', userId).eq('installationId', args.installationId)
    )
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, { fcmToken: args.fcmToken, updatedAt: Date.now() });
  } else {
    await ctx.db.insert('androidWidgetDevices', {
      userId,
      installationId: args.installationId,
      fcmToken: args.fcmToken,
      updatedAt: Date.now()
    });
  }
}

export async function unregisterWidgetDeviceHandler(
  ctx: ListsMutationCtx,
  { installationId }: { installationId: string }
) {
  requireRegistrationValue(installationId, 'Installation ID');
  const userId = await requireUserId(ctx);
  const existing = await ctx.db
    .query('androidWidgetDevices')
    .withIndex('by_user_id_and_installation_id', (q) => q.eq('userId', userId).eq('installationId', installationId))
    .unique();
  if (existing) await ctx.db.delete(existing._id);
}

export const register = mutation({
  args: {
    installationId: v.string(),
    fcmToken: v.string()
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await registerWidgetDeviceHandler(ctx, args);
    return null;
  }
});

export const unregister = mutation({
  args: { installationId: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await unregisterWidgetDeviceHandler(ctx, args);
    return null;
  }
});

export const listRegisteredDevices = internalQuery({
  args: { paginationOpts: paginationOptsValidator },
  returns: paginationResultValidator(registeredDevice),
  handler: async (ctx, { paginationOpts }) => {
    const result = await ctx.db.query('androidWidgetDevices').withIndex('by_updated_at').paginate(paginationOpts);
    return {
      ...result,
      page: result.page.map((device) => ({ id: device._id, fcmToken: device.fcmToken }))
    };
  }
});

export const retireInvalidToken = internalMutation({
  args: {
    deviceId: v.id('androidWidgetDevices'),
    fcmToken: v.string()
  },
  returns: v.null(),
  handler: async (ctx, { deviceId, fcmToken }) => {
    const device = await ctx.db.get(deviceId);
    if (device?.fcmToken === fcmToken) await ctx.db.delete(deviceId);
    return null;
  }
});
