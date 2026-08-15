import { v } from 'convex/values';

import { query, type QueryCtx } from '../_generated/server';
import { readListItems, requireVisibleList, sortActiveItems } from './items';

const widgetSnapshot = v.object({
  list: v.object({
    publicId: v.string(),
    name: v.string(),
    slug: v.string()
  }),
  activeItems: v.array(
    v.object({
      id: v.id('listItems'),
      title: v.string()
    })
  )
});

export async function readWidgetSnapshot(ctx: Pick<QueryCtx, 'auth' | 'db'>, { publicId }: { publicId: string }) {
  const visible = await requireVisibleList(ctx, publicId);
  if (!visible) return null;

  const activeItems = sortActiveItems(await readListItems(ctx, visible.list._id));
  return {
    list: {
      publicId: visible.list.publicId,
      name: visible.list.name,
      slug: visible.list.slug
    },
    activeItems: activeItems.map((item) => ({ id: item._id, title: item.title }))
  };
}

/** The minimal, authenticated projection used by the Android home-screen widget. */
export const getSnapshot = query({
  args: { publicId: v.string() },
  returns: v.union(widgetSnapshot, v.null()),
  handler: readWidgetSnapshot
});
