import { v } from 'convex/values';
import { mutation } from './_generated/server';

// ============================================================
// CURRENT ACCOUNTS — CRUD
// ============================================================
export const addCurrentAccount = mutation({
  args: {
    date: v.number(),
    currentSecondary: v.number(),
    shared: v.number(),
    currentPrimary: v.number(),
    other: v.number()
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('currentAccounts', {
      date: args.date,
      currentSecondary: args.currentSecondary,
      shared: args.shared,
      currentPrimary: args.currentPrimary,
      other: args.other
    });
  }
});

export const updateCurrentAccount = mutation({
  args: {
    id: v.id('currentAccounts'),
    currentSecondary: v.optional(v.number()),
    shared: v.optional(v.number()),
    currentPrimary: v.optional(v.number()),
    other: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    // Strip undefined values so we only patch what's provided
    const patch: Record<string, number> = {};
    if (fields.currentSecondary !== undefined)
      patch.currentSecondary = fields.currentSecondary;
    if (fields.shared !== undefined) patch.shared = fields.shared;
    if (fields.currentPrimary !== undefined)
      patch.currentPrimary = fields.currentPrimary;
    if (fields.other !== undefined) patch.other = fields.other;
    await ctx.db.patch(id, patch);
  }
});

export const deleteCurrentAccount = mutation({
  args: { id: v.id('currentAccounts') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  }
});

// ============================================================
// CASH ACCOUNTS — CRUD
// ============================================================
export const addCashAccount = mutation({
  args: {
    date: v.number(),
    saver: v.number(),
    highInterest: v.number()
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('cashAccounts', {
      date: args.date,
      saver: args.saver,
      highInterest: args.highInterest
    });
  }
});

export const updateCashAccount = mutation({
  args: {
    id: v.id('cashAccounts'),
    saver: v.optional(v.number()),
    highInterest: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, number> = {};
    if (fields.saver !== undefined) patch.saver = fields.saver;
    if (fields.highInterest !== undefined)
      patch.highInterest = fields.highInterest;
    await ctx.db.patch(id, patch);
  }
});

export const deleteCashAccount = mutation({
  args: { id: v.id('cashAccounts') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  }
});

// ============================================================
// UK ACCOUNTS — CRUD
// ============================================================
export const addUkAccount = mutation({
  args: {
    date: v.number(),
    currentGbp: v.number(),
    saverGbp: v.number(),
    cashIsaGbp: v.number(),
    sharesIsaGbp: v.number(),
    gbpAud: v.number()
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('ukAccounts', {
      date: args.date,
      currentGbp: args.currentGbp,
      saverGbp: args.saverGbp,
      cashIsaGbp: args.cashIsaGbp,
      sharesIsaGbp: args.sharesIsaGbp,
      gbpAud: args.gbpAud
    });
  }
});

export const updateUkAccount = mutation({
  args: {
    id: v.id('ukAccounts'),
    currentGbp: v.optional(v.number()),
    saverGbp: v.optional(v.number()),
    cashIsaGbp: v.optional(v.number()),
    sharesIsaGbp: v.optional(v.number()),
    gbpAud: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, number> = {};
    if (fields.currentGbp !== undefined) patch.currentGbp = fields.currentGbp;
    if (fields.saverGbp !== undefined) patch.saverGbp = fields.saverGbp;
    if (fields.cashIsaGbp !== undefined) patch.cashIsaGbp = fields.cashIsaGbp;
    if (fields.sharesIsaGbp !== undefined)
      patch.sharesIsaGbp = fields.sharesIsaGbp;
    if (fields.gbpAud !== undefined) patch.gbpAud = fields.gbpAud;
    await ctx.db.patch(id, patch);
  }
});

export const deleteUkAccount = mutation({
  args: { id: v.id('ukAccounts') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  }
});

// ============================================================
// SUPER ACCOUNTS — CRUD
// ============================================================
export const addSuperAccount = mutation({
  args: {
    date: v.number(),
    pension: v.number(),
    super1: v.number(),
    super2: v.number(),
    super3: v.number(),
    gbpAud: v.number()
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('superAccounts', {
      date: args.date,
      pension: args.pension,
      super1: args.super1,
      super2: args.super2,
      super3: args.super3,
      gbpAud: args.gbpAud
    });
  }
});

export const updateSuperAccount = mutation({
  args: {
    id: v.id('superAccounts'),
    pension: v.optional(v.number()),
    super1: v.optional(v.number()),
    super2: v.optional(v.number()),
    super3: v.optional(v.number()),
    gbpAud: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, number> = {};
    if (fields.pension !== undefined) patch.pension = fields.pension;
    if (fields.super1 !== undefined) patch.super1 = fields.super1;
    if (fields.super2 !== undefined) patch.super2 = fields.super2;
    if (fields.super3 !== undefined) patch.super3 = fields.super3;
    if (fields.gbpAud !== undefined) patch.gbpAud = fields.gbpAud;
    await ctx.db.patch(id, patch);
  }
});

export const deleteSuperAccount = mutation({
  args: { id: v.id('superAccounts') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  }
});

// ============================================================
// INVESTMENT ACCOUNTS — CRUD
// ============================================================
export const addInvestmentAccount = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('investmentAccounts', {
      date: args.date,
      managedFund1: args.managedFund1,
      investmentLoan: args.investmentLoan,
      tradingAus1: args.tradingAus1,
      tradingInt1: args.tradingInt1,
      tradingInt2: args.tradingInt2,
      usdAud: args.usdAud,
      managedFund2: args.managedFund2,
      tradingAus2: args.tradingAus2,
      managedFund3: args.managedFund3,
      crypto1: args.crypto1,
      crypto2: args.crypto2
    });
  }
});

export const updateInvestmentAccount = mutation({
  args: {
    id: v.id('investmentAccounts'),
    managedFund1: v.optional(v.number()),
    investmentLoan: v.optional(v.number()),
    tradingAus1: v.optional(v.number()),
    tradingInt1: v.optional(v.number()),
    tradingInt2: v.optional(v.number()),
    usdAud: v.optional(v.number()),
    managedFund2: v.optional(v.number()),
    tradingAus2: v.optional(v.number()),
    managedFund3: v.optional(v.number()),
    crypto1: v.optional(v.number()),
    crypto2: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, number> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) patch[key] = val;
    }
    await ctx.db.patch(id, patch);
  }
});

export const deleteInvestmentAccount = mutation({
  args: { id: v.id('investmentAccounts') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  }
});

// ============================================================
// MORTGAGE — CRUD
// ============================================================
export const addMortgage = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('mortgage', {
      date: args.date,
      deposit: args.deposit,
      familyContrib: args.familyContrib,
      debt1: args.debt1,
      debt2: args.debt2,
      interestCharged: args.interestCharged,
      principalPaid: args.principalPaid,
      contrib1: args.contrib1,
      contrib2: args.contrib2,
      contrib3: args.contrib3,
      price: args.price,
      landValue: args.landValue,
      capitalGrowth: args.capitalGrowth
    });
  }
});

export const updateMortgage = mutation({
  args: {
    id: v.id('mortgage'),
    deposit: v.optional(v.number()),
    familyContrib: v.optional(v.number()),
    debt1: v.optional(v.number()),
    debt2: v.optional(v.number()),
    interestCharged: v.optional(v.number()),
    principalPaid: v.optional(v.number()),
    contrib1: v.optional(v.number()),
    contrib2: v.optional(v.number()),
    contrib3: v.optional(v.number()),
    price: v.optional(v.number()),
    landValue: v.optional(v.number()),
    capitalGrowth: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, number> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) patch[key] = val;
    }
    await ctx.db.patch(id, patch);
  }
});

export const deleteMortgage = mutation({
  args: { id: v.id('mortgage') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  }
});

// ============================================================
// BUDGET — CRUD
// ============================================================
export const addBudget = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('budget', {
      date: args.date,
      incomePrimary: args.incomePrimary,
      incomeSecondary: args.incomeSecondary,
      billContrib: args.billContrib,
      credit2: args.credit2,
      credit1: args.credit1,
      credit3: args.credit3,
      oneOffs: args.oneOffs,
      shared: args.shared,
      sinkOrSwim: args.sinkOrSwim,
      variable: args.variable,
      fixed: args.fixed,
      rent: args.rent,
      rateVar: args.rateVar,
      rateFix: args.rateFix
    });
  }
});

export const updateBudget = mutation({
  args: {
    id: v.id('budget'),
    incomePrimary: v.optional(v.number()),
    incomeSecondary: v.optional(v.number()),
    billContrib: v.optional(v.number()),
    credit2: v.optional(v.number()),
    credit1: v.optional(v.number()),
    credit3: v.optional(v.number()),
    oneOffs: v.optional(v.number()),
    shared: v.optional(v.number()),
    sinkOrSwim: v.optional(v.number()),
    variable: v.optional(v.number()),
    fixed: v.optional(v.number()),
    rent: v.optional(v.number()),
    rateVar: v.optional(v.number()),
    rateFix: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, any> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) patch[key] = val;
    }
    await ctx.db.patch(id, patch);
  }
});

export const deleteBudget = mutation({
  args: { id: v.id('budget') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  }
});

// ============================================================
// CRYPTO TRANSACTIONS — CRUD
// ============================================================
export const addCryptoTransaction = mutation({
  args: {
    platform: v.union(v.literal('platform_a'), v.literal('platform_b')),
    date: v.optional(v.number()),
    type: v.union(v.literal('deposit'), v.literal('withdrawal')),
    amount: v.number()
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('cryptoTransactions', {
      platform: args.platform,
      date: args.date,
      type: args.type,
      amount: args.amount
    });
  }
});

export const deleteCryptoTransaction = mutation({
  args: { id: v.id('cryptoTransactions') },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  }
});

// ============================================================
// CRYPTO SUMMARIES — CRUD
// ============================================================
export const updateCryptoSummary = mutation({
  args: {
    id: v.id('cryptoSummaries'),
    totalDeposited: v.optional(v.number()),
    totalWithdrawn: v.optional(v.number()),
    currentValue: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const patch: Record<string, number> = {};
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined) patch[key] = val;
    }
    await ctx.db.patch(id, patch);
  }
});

// ============================================================
// BULK EXCHANGE RATE UPDATE
// Updates gbpAud or usdAud across multiple tables for a given date.
// Useful when you get new FX rates and need to refresh everything.
// ============================================================
export const updateExchangeRates = mutation({
  args: {
    date: v.number(),
    gbpAud: v.optional(v.number()),
    usdAud: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const updated: Array<string> = [];

    if (args.gbpAud !== undefined) {
      // Update UK accounts
      const ukRow = await ctx.db
        .query('ukAccounts')
        .withIndex('by_date', (q) => q.eq('date', args.date))
        .first();
      if (ukRow) {
        await ctx.db.patch(ukRow._id, { gbpAud: args.gbpAud });
        updated.push('ukAccounts');
      }

      // Update Super accounts
      const superRow = await ctx.db
        .query('superAccounts')
        .withIndex('by_date', (q) => q.eq('date', args.date))
        .first();
      if (superRow) {
        await ctx.db.patch(superRow._id, { gbpAud: args.gbpAud });
        updated.push('superAccounts');
      }
    }

    if (args.usdAud !== undefined) {
      // Update Investment accounts
      const investRow = await ctx.db
        .query('investmentAccounts')
        .withIndex('by_date', (q) => q.eq('date', args.date))
        .first();
      if (investRow) {
        await ctx.db.patch(investRow._id, { usdAud: args.usdAud });
        updated.push('investmentAccounts');
      }
    }

    return { updated };
  }
});

// ============================================================
// ADD SNAPSHOT — Insert a new row across ALL tables for a date.
// This is the equivalent of adding a new row in your Excel sheet.
// Pass only the tables you want to update; others are skipped.
// ============================================================
export const addSnapshot = mutation({
  args: {
    date: v.number(),
    current: v.optional(
      v.object({
        currentSecondary: v.number(),
        shared: v.number(),
        currentPrimary: v.number(),
        other: v.number()
      })
    ),
    cash: v.optional(
      v.object({
        saver: v.number(),
        highInterest: v.number()
      })
    ),
    uk: v.optional(
      v.object({
        currentGbp: v.number(),
        saverGbp: v.number(),
        cashIsaGbp: v.number(),
        sharesIsaGbp: v.number(),
        gbpAud: v.number()
      })
    ),
    super: v.optional(
      v.object({
        pension: v.number(),
        super1: v.number(),
        super2: v.number(),
        super3: v.number(),
        gbpAud: v.number()
      })
    ),
    investments: v.optional(
      v.object({
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
    ),
    mortgage: v.optional(
      v.object({
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
    ),
    budget: v.optional(
      v.object({
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
    const inserted: Array<string> = [];

    if (args.current) {
      await ctx.db.insert('currentAccounts', {
        date: args.date,
        ...args.current
      });
      inserted.push('currentAccounts');
    }
    if (args.cash) {
      await ctx.db.insert('cashAccounts', {
        date: args.date,
        ...args.cash
      });
      inserted.push('cashAccounts');
    }
    if (args.uk) {
      await ctx.db.insert('ukAccounts', {
        date: args.date,
        ...args.uk
      });
      inserted.push('ukAccounts');
    }
    if (args.super) {
      await ctx.db.insert('superAccounts', {
        date: args.date,
        ...args.super
      });
      inserted.push('superAccounts');
    }
    if (args.investments) {
      await ctx.db.insert('investmentAccounts', {
        date: args.date,
        ...args.investments
      });
      inserted.push('investmentAccounts');
    }
    if (args.mortgage) {
      await ctx.db.insert('mortgage', {
        date: args.date,
        ...args.mortgage
      });
      inserted.push('mortgage');
    }
    if (args.budget) {
      await ctx.db.insert('budget', {
        date: args.date,
        ...args.budget
      });
      inserted.push('budget');
    }

    return { date: args.date, inserted };
  }
});
