import { v } from 'convex/values';
import { mutation } from './_generated/server';

// ============================================================
// SEED: Current Accounts
// ============================================================
export const seedCurrentAccounts = mutation({
  args: {
    rows: v.array(
      v.object({
        date: v.number(),
        currentSecondary: v.number(),
        shared: v.number(),
        currentPrimary: v.number(),
        other: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert('currentAccounts', {
        date: row.date,
        currentSecondary: row.currentSecondary,
        shared: row.shared,
        currentPrimary: row.currentPrimary,
        other: row.other
      });
    }
    return { inserted: args.rows.length };
  }
});

// ============================================================
// SEED: Cash Accounts
// ============================================================
export const seedCashAccounts = mutation({
  args: {
    rows: v.array(
      v.object({
        date: v.number(),
        saver: v.number(),
        highInterest: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert('cashAccounts', {
        date: row.date,
        saver: row.saver,
        highInterest: row.highInterest
      });
    }
    return { inserted: args.rows.length };
  }
});

// ============================================================
// SEED: UK Accounts
// ============================================================
export const seedUkAccounts = mutation({
  args: {
    rows: v.array(
      v.object({
        date: v.number(),
        currentGbp: v.number(),
        saverGbp: v.number(),
        cashIsaGbp: v.number(),
        sharesIsaGbp: v.number(),
        gbpAud: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert('ukAccounts', {
        date: row.date,
        currentGbp: row.currentGbp,
        saverGbp: row.saverGbp,
        cashIsaGbp: row.cashIsaGbp,
        sharesIsaGbp: row.sharesIsaGbp,
        gbpAud: row.gbpAud
      });
    }
    return { inserted: args.rows.length };
  }
});

// ============================================================
// SEED: Super Accounts
// ============================================================
export const seedSuperAccounts = mutation({
  args: {
    rows: v.array(
      v.object({
        date: v.number(),
        pension: v.number(),
        super1: v.number(),
        super2: v.number(),
        super3: v.number(),
        gbpAud: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert('superAccounts', {
        date: row.date,
        pension: row.pension,
        super1: row.super1,
        super2: row.super2,
        super3: row.super3,
        gbpAud: row.gbpAud
      });
    }
    return { inserted: args.rows.length };
  }
});

// ============================================================
// SEED: Investment Accounts
// ============================================================
export const seedInvestmentAccounts = mutation({
  args: {
    rows: v.array(
      v.object({
        date: v.number(),
        managedFund1: v.number(),
        investmentLoan: v.number(),
        tradingAus1: v.number(),
        tradingInt1: v.number(),
        tradingInt2: v.number(),
        usdAud: v.number(),
        managedFund2: v.number(),
        tradingAus2: v.number(),
        managedFund3: v.number(),
        crypto1: v.number(),
        crypto2: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert('investmentAccounts', {
        date: row.date,
        managedFund1: row.managedFund1,
        investmentLoan: row.investmentLoan,
        tradingAus1: row.tradingAus1,
        tradingInt1: row.tradingInt1,
        tradingInt2: row.tradingInt2,
        usdAud: row.usdAud,
        managedFund2: row.managedFund2,
        tradingAus2: row.tradingAus2,
        managedFund3: row.managedFund3,
        crypto1: row.crypto1,
        crypto2: row.crypto2
      });
    }
    return { inserted: args.rows.length };
  }
});

// ============================================================
// SEED: Mortgage
// ============================================================
export const seedMortgage = mutation({
  args: {
    rows: v.array(
      v.object({
        date: v.number(),
        deposit: v.number(),
        familyContrib: v.number(),
        debt1: v.number(),
        debt2: v.number(),
        interestCharged: v.number(),
        principalPaid: v.number(),
        contrib1: v.number(),
        contrib2: v.number(),
        contrib3: v.number(),
        price: v.number(),
        landValue: v.number(),
        capitalGrowth: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert('mortgage', {
        date: row.date,
        deposit: row.deposit,
        familyContrib: row.familyContrib,
        debt1: row.debt1,
        debt2: row.debt2,
        interestCharged: row.interestCharged,
        principalPaid: row.principalPaid,
        contrib1: row.contrib1,
        contrib2: row.contrib2,
        contrib3: row.contrib3,
        price: row.price,
        landValue: row.landValue,
        capitalGrowth: row.capitalGrowth
      });
    }
    return { inserted: args.rows.length };
  }
});

// ============================================================
// SEED: Budget
// ============================================================
export const seedBudget = mutation({
  args: {
    rows: v.array(
      v.object({
        date: v.number(),
        incomePrimary: v.number(),
        incomeSecondary: v.number(),
        billContrib: v.number(),
        credit2: v.number(),
        credit1: v.number(),
        credit3: v.number(),
        oneOffs: v.number(),
        shared: v.number(),
        sinkOrSwim: v.number(),
        variable: v.number(),
        fixed: v.number(),
        rent: v.number(),
        rateVar: v.optional(v.number()),
        rateFix: v.optional(v.number())
      })
    )
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert('budget', {
        date: row.date,
        incomePrimary: row.incomePrimary,
        incomeSecondary: row.incomeSecondary,
        billContrib: row.billContrib,
        credit2: row.credit2,
        credit1: row.credit1,
        credit3: row.credit3,
        oneOffs: row.oneOffs,
        shared: row.shared,
        sinkOrSwim: row.sinkOrSwim,
        variable: row.variable,
        fixed: row.fixed,
        rent: row.rent,
        rateVar: row.rateVar,
        rateFix: row.rateFix
      });
    }
    return { inserted: args.rows.length };
  }
});

// ============================================================
// SEED: Crypto Transactions
// ============================================================
export const seedCryptoTransactions = mutation({
  args: {
    rows: v.array(
      v.object({
        platform: v.union(v.literal('platform_a'), v.literal('platform_b')),
        date: v.optional(v.number()),
        type: v.union(v.literal('deposit'), v.literal('withdrawal')),
        amount: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert('cryptoTransactions', {
        platform: row.platform,
        date: row.date,
        type: row.type,
        amount: row.amount
      });
    }
    return { inserted: args.rows.length };
  }
});

// ============================================================
// SEED: Crypto Summaries
// ============================================================
export const seedCryptoSummaries = mutation({
  args: {
    rows: v.array(
      v.object({
        platform: v.union(v.literal('platform_a'), v.literal('platform_b')),
        totalDeposited: v.number(),
        totalWithdrawn: v.number(),
        currentValue: v.number()
      })
    )
  },
  handler: async (ctx, args) => {
    for (const row of args.rows) {
      await ctx.db.insert('cryptoSummaries', {
        platform: row.platform,
        totalDeposited: row.totalDeposited,
        totalWithdrawn: row.totalWithdrawn,
        currentValue: row.currentValue
      });
    }
    return { inserted: args.rows.length };
  }
});
