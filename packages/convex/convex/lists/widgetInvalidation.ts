import { internal } from '../_generated/api';
import type { MutationCtx } from '../_generated/server';

/** Queue a content-free refresh signal; devices decide locally which configured lists to refresh. */
export async function enqueueWidgetInvalidation(ctx: Pick<MutationCtx, 'scheduler'>) {
  await ctx.scheduler.runAfter(0, internal.lists.widgetDelivery.sendInvalidations, {});
}
