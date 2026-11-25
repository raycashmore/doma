import { v } from 'convex/values';

import { internalQuery, query, type QueryCtx } from './_generated/server';
import { summarizeBudgetForPeriod, type SummaryPeriod } from './budgetSummary';
import {
  budgetMortgagePortion,
  budgetNetGainLoss,
  budgetSinkOrSwim,
  budgetSpend,
  budgetTotalIn,
  budgetTotalOut,
  cashAccountTotal,
  computeTotals,
  cryptoNet,
  currentAccountTotal,
  investmentManagedFundNet,
  investmentTotal,
  mortgageConfigForTotals,
  mortgageEquity,
  mortgagePaymentTotal,
  mortgageTotalDebt,
  superPensionAud,
  superTotal,
  ukAudGbp,
  ukTotalAud,
  ukTotalGbp
} from './helpers';
import { pickLatestSpendingInsight } from './insights/latest';
import { shapeMonthDetail } from './monthDetail';
import { buildMonthlyBreakdown, buildMortgageByMonth, utcYearMonthKey } from './monthlyBreakdown';
import { requireSignedIn } from './signedIn';
import { monthKeyFromTimestamp } from './spendingSummary';

function sameMonth<T extends { date: number }>(row: T | null, date: number): T | null {
  return row && utcYearMonthKey(row.date) === utcYearMonthKey(date) ? row : null;
}

async function getDefaultMortgageConfig(ctx: QueryCtx) {
  return ctx.db
    .query('mortgageConfig')
    .withIndex('by_key', (q) => q.eq('key', 'default'))
    .first();
}

// ============================================================
// CURRENT ACCOUNTS
// ============================================================
export const listCurrentAccounts = internalQuery({
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

export const getCurrentAccountByDate = internalQuery({
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
export const listCashAccounts = internalQuery({
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
export const listUkAccounts = internalQuery({
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
export const listSuperAccounts = internalQuery({
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
export const listInvestmentAccounts = internalQuery({
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
export const listMortgage = internalQuery({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const [rows, configRow] = await Promise.all([
      ctx.db
        .query('mortgage')
        .withIndex('by_date')
        .order('desc')
        .take(args.limit ?? 100),
      getDefaultMortgageConfig(ctx)
    ]);
    const config = mortgageConfigForTotals(configRow);

    return rows.map((row) => ({
      ...row,
      paymentTotal: mortgagePaymentTotal(row),
      totalDebt: mortgageTotalDebt(row),
      equity: mortgageEquity(row, config)
    }));
  }
});

// ============================================================
// BUDGET
// ============================================================
export const listBudget = internalQuery({
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
export const listCryptoTransactions = internalQuery({
  args: {
    platform: v.optional(v.union(v.literal('platform_a'), v.literal('platform_b')))
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

export const listCryptoSummaries = internalQuery({
  handler: async (ctx) => {
    const rows = await ctx.db.query('cryptoSummaries').collect();
    return rows.map((row) => ({
      ...row,
      net: cryptoNet(row)
    }));
  }
});

// ============================================================
// BUDGET CHART — Time series for Spend vs Sink or Swim chart
// ============================================================
export const listBudgetChart = query({
  handler: async (ctx) => {
    await requireSignedIn(ctx);
    const [budgetRows, mortgageRows] = await Promise.all([
      ctx.db.query('budget').withIndex('by_date').order('asc').collect(),
      ctx.db.query('mortgage').withIndex('by_date').order('asc').collect()
    ]);
    const mortgageByMonth = buildMortgageByMonth(mortgageRows);

    return budgetRows.map((row) => {
      const mortgage = mortgageByMonth.get(utcYearMonthKey(row.date)) ?? null;
      return {
        date: row.date,
        spend: budgetSpend(row),
        sinkOrSwim: budgetSinkOrSwim(row, mortgage),
        mortgage: budgetMortgagePortion(mortgage)
      };
    });
  }
});

// ============================================================
// TOTALS — Aggregate view across all tables
// Replicates the TOTALS sheet by joining latest rows from each table
// ============================================================
export const getLatestTotals = internalQuery({
  handler: async (ctx) => {
    const [superRow, ukRow, investRow, mortgageRow, mortgageConfig, cashRow, currentRow] = await Promise.all([
      ctx.db.query('superAccounts').withIndex('by_date').order('desc').first(),
      ctx.db.query('ukAccounts').withIndex('by_date').order('desc').first(),
      ctx.db.query('investmentAccounts').withIndex('by_date').order('desc').first(),
      ctx.db.query('mortgage').withIndex('by_date').order('desc').first(),
      getDefaultMortgageConfig(ctx),
      ctx.db.query('cashAccounts').withIndex('by_date').order('desc').first(),
      ctx.db.query('currentAccounts').withIndex('by_date').order('desc').first()
    ]);

    if (!superRow || !ukRow || !investRow || !mortgageRow || !mortgageConfig || !cashRow || !currentRow) {
      return null;
    }

    return computeTotals({
      super: superRow,
      uk: ukRow,
      investments: investRow,
      mortgage: mortgageRow,
      mortgageConfig,
      cash: cashRow,
      current: currentRow
    });
  }
});

// ============================================================
// TOTALS HISTORY — Time series of totals for charting
// Joins all tables by date to replicate the TOTALS sheet
// ============================================================
export const getTotalsHistory = internalQuery({
  args: {
    limit: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const [superRows, ukRows, investRows, mortgageRows, mortgageConfig, cashRows, currentRows] = await Promise.all([
      ctx.db.query('superAccounts').withIndex('by_date').order('asc').collect(),
      ctx.db.query('ukAccounts').withIndex('by_date').order('asc').collect(),
      ctx.db.query('investmentAccounts').withIndex('by_date').order('asc').collect(),
      ctx.db.query('mortgage').withIndex('by_date').order('asc').collect(),
      getDefaultMortgageConfig(ctx),
      ctx.db.query('cashAccounts').withIndex('by_date').order('asc').collect(),
      ctx.db.query('currentAccounts').withIndex('by_date').order('asc').collect()
    ]);

    if (!mortgageConfig) return [];

    // Build maps by date
    const superMap = new Map(superRows.map((r) => [r.date, r]));
    const ukMap = new Map(ukRows.map((r) => [r.date, r]));
    const investMap = new Map(investRows.map((r) => [r.date, r]));
    const mortgageMap = new Map(mortgageRows.map((r) => [r.date, r]));
    const cashMap = new Map(cashRows.map((r) => [r.date, r]));
    const currentMap = new Map(currentRows.map((r) => [r.date, r]));

    // Collect all unique dates
    const allDates = new Set<number>();
    for (const rows of [superRows, ukRows, investRows, mortgageRows, cashRows, currentRows]) {
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

      if (lastSuper && lastUk && lastInvest && lastMortgage && lastCash && lastCurrent) {
        results.push({
          date,
          ...computeTotals({
            super: lastSuper,
            uk: lastUk,
            investments: lastInvest,
            mortgage: lastMortgage,
            mortgageConfig,
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

// ============================================================
// MONTHLY BREAKDOWN — per-month income, spend, mortgage, net
// ============================================================
export const getMonthlyBreakdown = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const [budgetRows, mortgageRows] = await Promise.all([
      ctx.db.query('budget').withIndex('by_date').order('asc').collect(),
      ctx.db.query('mortgage').withIndex('by_date').order('asc').collect()
    ]);
    return buildMonthlyBreakdown(budgetRows, mortgageRows, args.limit);
  }
});

// ============================================================
// MONTHLY DETAIL — single month overlay data (budget + mortgage carry-forward)
// ============================================================
export const getMonthlyDetail = query({
  args: { date: v.number() },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const [budget, mortgageConfig, spendCategories] = await Promise.all([
      ctx.db
        .query('budget')
        .withIndex('by_date', (q) => q.eq('date', args.date))
        .first(),
      getDefaultMortgageConfig(ctx),
      ctx.db
        .query('spendCategoryBreakdown')
        .withIndex('by_month', (q) => q.eq('monthKey', monthKeyFromTimestamp(args.date)))
        .collect()
    ]);

    // Each month's own mortgage row (the latest in that month), as the months list uses.
    const mortgage = sameMonth(
      await ctx.db
        .query('mortgage')
        .withIndex('by_date', (q) => q.lte('date', args.date))
        .order('desc')
        .first(),
      args.date
    );

    // Prior-month budget row (most recent strictly before args.date)
    const priorBudget = await ctx.db
      .query('budget')
      .withIndex('by_date', (q) => q.lt('date', args.date))
      .order('desc')
      .first();

    const priorMortgage = priorBudget
      ? sameMonth(
          await ctx.db
            .query('mortgage')
            .withIndex('by_date', (q) => q.lte('date', priorBudget.date))
            .order('desc')
            .first(),
          priorBudget.date
        )
      : null;

    return shapeMonthDetail(budget, mortgage, mortgageConfig, priorBudget, priorMortgage, spendCategories);
  }
});

// ============================================================
// SPENDING INSIGHTS — Latest monthly spending insight for the panel
// ============================================================
export const getLatestSpendingInsight = query({
  handler: async (ctx) => {
    await requireSignedIn(ctx);
    const rows = await ctx.db.query('spendingInsights').withIndex('by_month_key').collect();
    const latest = pickLatestSpendingInsight(rows);
    if (!latest) return null;

    return {
      monthKey: latest.monthKey,
      headline: latest.headline,
      observations: latest.observations,
      prediction: latest.prediction,
      generatedAt: latest.generatedAt
    };
  }
});

// ============================================================
// BUDGET PAGE SUMMARY — KPI cards with period comparisons
// ============================================================
export const getBudgetPageSummary = query({
  // Reads the clock, so callers pass a changing token; see "Queries that read the clock" in docs/convex-backend.md.
  args: {
    period: v.union(v.literal('3M'), v.literal('6M'), v.literal('12M'), v.literal('ALL')),
    refreshToken: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    await requireSignedIn(ctx);
    const [rows, mortgageRows] = await Promise.all([
      ctx.db.query('budget').withIndex('by_date').order('asc').collect(),
      ctx.db.query('mortgage').withIndex('by_date').order('asc').collect()
    ]);
    return summarizeBudgetForPeriod(rows, mortgageRows, args.period as SummaryPeriod, Date.now());
  }
});
