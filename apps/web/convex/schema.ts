import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

export default defineSchema({
  // ============================================================
  // CURRENT ACCOUNTS — Bank account balances (Current sheet)
  // ============================================================
  currentAccounts: defineTable({
    date: v.number(), // Unix timestamp (ms)
    currentSecondary: v.number(),
    shared: v.number(),
    currentPrimary: v.number(),
    other: v.number()
  }).index('by_date', ['date']),

  // ============================================================
  // CASH ACCOUNTS — Savings accounts (Cash sheet)
  // ============================================================
  cashAccounts: defineTable({
    date: v.number(),
    saver: v.number(),
    highInterest: v.number()
    // DERIVED: total = saver + highInterest
  }).index('by_date', ['date']),

  // ============================================================
  // UK ACCOUNTS — UK bank accounts in GBP
  // Stores raw GBP values + exchange rate; AUD totals derived
  // ============================================================
  ukAccounts: defineTable({
    date: v.number(),
    currentGbp: v.number(),
    saverGbp: v.number(),
    cashIsaGbp: v.number(),
    sharesIsaGbp: v.number(),
    gbpAud: v.number() // Exchange rate — external input, must be stored
  }).index('by_date', ['date']),

  // ============================================================
  // SUPERANNUATION — Pension/retirement accounts
  // ============================================================
  superAccounts: defineTable({
    date: v.number(),
    pension: v.number(), // GBP pension fund
    super1: v.number(), // AUD
    super2: v.number(), // AUD
    super3: v.number(), // AUD
    gbpAud: v.number() // Exchange rate for pension conversion
  }).index('by_date', ['date']),

  // ============================================================
  // INVESTMENTS — Brokerage & investment accounts
  // ============================================================
  investmentAccounts: defineTable({
    date: v.number(),
    managedFund1: v.number(),
    investmentLoan: v.number(), // Typically negative
    tradingAus1: v.number(),
    tradingInt1: v.number(),
    tradingInt2: v.number(), // USD value
    usdAud: v.number(), // Exchange rate — external input
    managedFund2: v.number(),
    tradingAus2: v.number(),
    managedFund3: v.number(),
    crypto1: v.number(),
    crypto2: v.number()
  }).index('by_date', ['date']),

  // ============================================================
  // MORTGAGE — Property debt, equity & contributions
  // ============================================================
  mortgage: defineTable({
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
    price: v.number(), // Property price — external input
    landValue: v.number(), // Land value — external input
    capitalGrowth: v.number() // Capital growth — external input
  }).index('by_date', ['date']),

  // ============================================================
  // BUDGET — Monthly income vs. expenses
  // ============================================================
  budget: defineTable({
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
  }).index('by_date', ['date']),

  // ============================================================
  // CRYPTO — Deposit/withdrawal transactions
  // ============================================================
  cryptoTransactions: defineTable({
    platform: v.union(v.literal('platform_a'), v.literal('platform_b')),
    date: v.optional(v.number()),
    type: v.union(v.literal('deposit'), v.literal('withdrawal')),
    amount: v.number()
  })
    .index('by_platform', ['platform'])
    .index('by_platform_date', ['platform', 'date']),

  // ============================================================
  // CRYPTO SUMMARIES — Aggregated platform stats
  // ============================================================
  cryptoSummaries: defineTable({
    platform: v.union(v.literal('platform_a'), v.literal('platform_b')),
    totalDeposited: v.number(),
    totalWithdrawn: v.number(),
    currentValue: v.number()
    // DERIVED: net = currentValue - (totalDeposited - totalWithdrawn)
  }).index('by_platform', ['platform'])
});
