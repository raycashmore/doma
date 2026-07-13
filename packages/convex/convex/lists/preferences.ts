import { v } from 'convex/values';

import { mutation, query } from '../_generated/server';
import { readActiveGroupingPropertyForUser, setActiveGroupingPropertyForUser } from './groupingPreferences';
import { requireUserId } from './items';

/** The signed-in user's active grouping for one visible list. */
export const getActiveGroupingProperty = query({
  args: { listPublicId: v.string() },
  handler: async (ctx, { listPublicId }) => {
    const currentUserId = await requireUserId(ctx);
    return readActiveGroupingPropertyForUser(ctx, { currentUserId, listPublicId });
  }
});

/** Set or clear the signed-in user's active grouping for one visible list. */
export const setActiveGroupingProperty = mutation({
  args: {
    listPublicId: v.string(),
    propertyId: v.union(v.id('listProperties'), v.null())
  },
  handler: async (ctx, { listPublicId, propertyId }) => {
    const currentUserId = await requireUserId(ctx);
    return setActiveGroupingPropertyForUser(ctx, { currentUserId, listPublicId, propertyId });
  }
});
