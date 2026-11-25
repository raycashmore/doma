import { ConvexError, v } from 'convex/values';

import { query, type QueryCtx } from './_generated/server';
import { requireSignedIn } from './signedIn';
import { buildSpendingMonths, isMonthKey, monthsInRange, summarizeRange } from './spendingModel';

async function loadMonths(ctx: QueryCtx) {
  const [budgetRows, mortgageRows] = await Promise.all([
    ctx.db.query('budget').withIndex('by_date').order('asc').collect(),
    ctx.db.query('mortgage').withIndex('by_date').order('asc').collect()
  ]);
  return buildSpendingMonths(budgetRows, mortgageRows);
}

/** Every month's net, oldest first: the range strip, and what clients resolve presets ("last 6 months", a financial year) against. */
export const listMonths = query({
  args: {},
  handler: async (ctx) => {
    await requireSignedIn(ctx);
    const months = await loadMonths(ctx);
    return months.map(({ monthKey, date, net }) => ({ monthKey, date, net }));
  }
});

/** The figures, chart and months for an inclusive range of `YYYY-MM` months. */
export const getSpending = query({
  args: { from: v.string(), to: v.string() },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    if (!isMonthKey(args.from) || !isMonthKey(args.to) || args.from > args.to) {
      throw new ConvexError('Invalid month range');
    }
    const range = { from: args.from, to: args.to };
    const months = await loadMonths(ctx);
    return {
      ...range,
      months: monthsInRange(months, range),
      summary: summarizeRange(months, range)
    };
  }
});
