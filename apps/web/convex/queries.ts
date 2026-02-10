import { v } from 'convex/values';
import { query } from './_generated/server';
import {
  budgetNetGainLoss,
  budgetTotalIn,
  budgetTotalOut,
  cashAccountTotal,
  computeTotals,
  cryptoNet,
  currentAccountTotal,
  investmentManagedFundNet,
  investmentTotal,
  mortgageEquity,
  mortgageTotalDebt,
  superPensionAud,
  superTotal,
  ukAudGbp,
  ukTotalAud,
  ukTotalGbp
} from './helpers';

// ============================================================
// CURRENT ACCOUNTS
// ============================================================
export const listCurrentAccounts = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('currentAccounts')
      .withIndex('by_date')
      .order('desc')
      .take(args.limit ?? 100);

    return rows.map((row) => ({
      ...row,
      total: currentAccountTotal(row)
    }));
  }
});

export const getCurrentAccountByDate = query({
  args: { date: v.number() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('currentAccounts')
      .withIndex('by_date', (q) => q.eq('date', args.date))
      .first();
    if (!row) return null;
    return { ...row, total: currentAccountTotal(row) };
  }
});

// ============================================================
// CASH ACCOUNTS
// ============================================================
export const listCashAccounts = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('cashAccounts')
      .withIndex('by_date')
      .order('desc')
      .take(args.limit ?? 100);

    return rows.map((row) => ({
      ...row,
      total: cashAccountTotal(row)
    }));
  }
});

// ============================================================
// UK ACCOUNTS
// ============================================================
export const listUkAccounts = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('ukAccounts')
      .withIndex('by_date')
      .order('desc')
      .take(args.limit ?? 100);

    return rows.map((row) => ({
      ...row,
      totalGbp: ukTotalGbp(row),
      totalAud: ukTotalAud(row),
      audGbp: ukAudGbp(row)
    }));
  }
});

// ============================================================
// SUPER ACCOUNTS
// ============================================================
export const listSuperAccounts = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('superAccounts')
      .withIndex('by_date')
      .order('desc')
      .take(args.limit ?? 100);

    return rows.map((row) => ({
      ...row,
      pensionAud: superPensionAud(row),
      total: superTotal(row)
    }));
  }
});

// ============================================================
// INVESTMENT ACCOUNTS
// ============================================================
export const listInvestmentAccounts = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('investmentAccounts')
      .withIndex('by_date')
      .order('desc')
      .take(args.limit ?? 100);

    return rows.map((row) => ({
      ...row,
      managedFundNet: investmentManagedFundNet(row),
      total: investmentTotal(row)
    }));
  }
});

// ============================================================
// MORTGAGE
// ============================================================
export const listMortgage = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('mortgage')
      .withIndex('by_date')
      .order('desc')
      .take(args.limit ?? 100);

    return rows.map((row) => ({
      ...row,
      totalDebt: mortgageTotalDebt(row),
      equity: mortgageEquity(row)
    }));
  }
});

// ============================================================
// BUDGET
// ============================================================
export const listBudget = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query('budget')
      .withIndex('by_date')
      .order('desc')
      .take(args.limit ?? 100);

    return rows.map((row) => ({
      ...row,
      totalIn: budgetTotalIn(row),
      totalOut: budgetTotalOut(row),
      netGainLoss: budgetNetGainLoss(row)
    }));
  }
});

// ============================================================
// CRYPTO
// ============================================================
export const listCryptoTransactions = query({
  args: {
    platform: v.optional(
      v.union(v.literal('platform_a'), v.literal('platform_b'))
    )
  },
  handler: async (ctx, args) => {
    if (args.platform) {
      return ctx.db
        .query('cryptoTransactions')
        .withIndex('by_platform', (q) => q.eq('platform', args.platform!))
        .collect();
    }
    return ctx.db.query('cryptoTransactions').collect();
  }
});

export const listCryptoSummaries = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query('cryptoSummaries').collect();
    return rows.map((row) => ({
      ...row,
      net: cryptoNet(row)
    }));
  }
});

// ============================================================
// TOTALS — Aggregate view across all tables
// Replicates the TOTALS sheet by joining latest rows from each table
// ============================================================
export const getLatestTotals = query({
  handler: async (ctx) => {
    const [superRow, ukRow, investRow, mortgageRow, cashRow, currentRow] =
      await Promise.all([
        ctx.db
          .query('superAccounts')
          .withIndex('by_date')
          .order('desc')
          .first(),
        ctx.db.query('ukAccounts').withIndex('by_date').order('desc').first(),
        ctx.db
          .query('investmentAccounts')
          .withIndex('by_date')
          .order('desc')
          .first(),
        ctx.db.query('mortgage').withIndex('by_date').order('desc').first(),
        ctx.db.query('cashAccounts').withIndex('by_date').order('desc').first(),
        ctx.db
          .query('currentAccounts')
          .withIndex('by_date')
          .order('desc')
          .first()
      ]);

    if (
      !superRow ||
      !ukRow ||
      !investRow ||
      !mortgageRow ||
      !cashRow ||
      !currentRow
    ) {
      return null;
    }

    return computeTotals({
      super: superRow,
      uk: ukRow,
      investments: investRow,
      mortgage: mortgageRow,
      cash: cashRow,
      current: currentRow
    });
  }
});

// ============================================================
// TOTALS HISTORY — Time series of totals for charting
// Joins all tables by date to replicate the TOTALS sheet
// ============================================================
export const getTotalsHistory = query({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const [superRows, ukRows, investRows, mortgageRows, cashRows, currentRows] =
      await Promise.all([
        ctx.db
          .query('superAccounts')
          .withIndex('by_date')
          .order('asc')
          .collect(),
        ctx.db.query('ukAccounts').withIndex('by_date').order('asc').collect(),
        ctx.db
          .query('investmentAccounts')
          .withIndex('by_date')
          .order('asc')
          .collect(),
        ctx.db.query('mortgage').withIndex('by_date').order('asc').collect(),
        ctx.db
          .query('cashAccounts')
          .withIndex('by_date')
          .order('asc')
          .collect(),
        ctx.db
          .query('currentAccounts')
          .withIndex('by_date')
          .order('asc')
          .collect()
      ]);

    // Build maps by date
    const superMap = new Map(superRows.map((r) => [r.date, r]));
    const ukMap = new Map(ukRows.map((r) => [r.date, r]));
    const investMap = new Map(investRows.map((r) => [r.date, r]));
    const mortgageMap = new Map(mortgageRows.map((r) => [r.date, r]));
    const cashMap = new Map(cashRows.map((r) => [r.date, r]));
    const currentMap = new Map(currentRows.map((r) => [r.date, r]));

    // Collect all unique dates
    const allDates = new Set<number>();
    for (const rows of [
      superRows,
      ukRows,
      investRows,
      mortgageRows,
      cashRows,
      currentRows
    ]) {
      for (const r of rows) allDates.add(r.date);
    }

    // Process in ascending order, carry forward last-known values
    let lastSuper: (typeof superRows)[0] | undefined;
    let lastUk: (typeof ukRows)[0] | undefined;
    let lastInvest: (typeof investRows)[0] | undefined;
    let lastMortgage: (typeof mortgageRows)[0] | undefined;
    let lastCash: (typeof cashRows)[0] | undefined;
    let lastCurrent: (typeof currentRows)[0] | undefined;

    const results = [];
    for (const date of [...allDates].sort((a, b) => a - b)) {
      lastSuper = superMap.get(date) ?? lastSuper;
      lastUk = ukMap.get(date) ?? lastUk;
      lastInvest = investMap.get(date) ?? lastInvest;
      lastMortgage = mortgageMap.get(date) ?? lastMortgage;
      lastCash = cashMap.get(date) ?? lastCash;
      lastCurrent = currentMap.get(date) ?? lastCurrent;

      if (
        lastSuper &&
        lastUk &&
        lastInvest &&
        lastMortgage &&
        lastCash &&
        lastCurrent
      ) {
        results.push({
          date,
          ...computeTotals({
            super: lastSuper,
            uk: lastUk,
            investments: lastInvest,
            mortgage: lastMortgage,
            cash: lastCash,
            current: lastCurrent
          })
        });
      }
    }

    results.reverse(); // desc order
    return args.limit ? results.slice(0, args.limit) : results;
  }
});
