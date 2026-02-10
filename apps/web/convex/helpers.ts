import type { Doc } from './_generated/dataModel';

// ============================================================
// CURRENT ACCOUNTS — derived total
// ============================================================
export function currentAccountTotal(row: Doc<'currentAccounts'>) {
  return row.currentSecondary + row.shared + row.currentPrimary + row.other;
}

// ============================================================
// CASH ACCOUNTS — derived total
// ============================================================
export function cashAccountTotal(row: Doc<'cashAccounts'>) {
  return row.saver + row.highInterest;
}

// ============================================================
// UK ACCOUNTS — derived fields
// ============================================================
export function ukTotalGbp(row: Doc<'ukAccounts'>) {
  return row.currentGbp + row.saverGbp + row.cashIsaGbp + row.sharesIsaGbp;
}

export function ukTotalAud(row: Doc<'ukAccounts'>) {
  return ukTotalGbp(row) * row.gbpAud;
}

export function ukAudGbp(row: Doc<'ukAccounts'>) {
  return row.gbpAud === 0 ? 0 : 1 / row.gbpAud;
}

// ============================================================
// SUPER ACCOUNTS — derived fields
// ============================================================
export function superPensionAud(row: Doc<'superAccounts'>) {
  return row.pension * row.gbpAud;
}

export function superTotal(row: Doc<'superAccounts'>) {
  return superPensionAud(row) + row.super1 + row.super2 + row.super3;
}

// ============================================================
// INVESTMENTS — derived fields
// ============================================================
export function investmentManagedFundNet(row: Doc<'investmentAccounts'>) {
  return row.managedFund1 + row.investmentLoan;
}

export function investmentTotal(row: Doc<'investmentAccounts'>) {
  return (
    investmentManagedFundNet(row) +
    row.tradingAus1 +
    row.tradingInt1 +
    row.tradingInt2 * row.usdAud +
    row.managedFund2 +
    row.tradingAus2 +
    row.managedFund3 +
    row.crypto1 +
    row.crypto2
  );
}

// ============================================================
// MORTGAGE — derived fields
// ============================================================
export function mortgageTotalDebt(row: Doc<'mortgage'>) {
  return row.debt1 + row.debt2;
}

export function mortgageEquity(row: Doc<'mortgage'>) {
  return row.price - mortgageTotalDebt(row);
}

// ============================================================
// BUDGET (Sink or Swim) — derived fields
// ============================================================
export function budgetTotalIn(row: Doc<'budget'>) {
  return row.incomePrimary + row.incomeSecondary + row.billContrib;
}

export function budgetTotalOut(row: Doc<'budget'>) {
  return row.credit2 + row.credit1 + row.credit3 + row.oneOffs + row.shared;
}

export function budgetNetGainLoss(row: Doc<'budget'>) {
  return budgetTotalIn(row) - budgetTotalOut(row);
}

// ============================================================
// CRYPTO SUMMARIES — derived net
// ============================================================
export function cryptoNet(row: Doc<'cryptoSummaries'>) {
  return row.currentValue - (row.totalDeposited - row.totalWithdrawn);
}

// ============================================================
// TOTALS — grand aggregation across all tables
// ============================================================
export interface TotalsInput {
  super: Doc<'superAccounts'>;
  uk: Doc<'ukAccounts'>;
  investments: Doc<'investmentAccounts'>;
  mortgage: Doc<'mortgage'>;
  cash: Doc<'cashAccounts'>;
  current: Doc<'currentAccounts'>;
}

export function computeTotals(input: TotalsInput) {
  const superVal = superTotal(input.super);
  const ukVal = ukTotalAud(input.uk);
  const investVal = investmentTotal(input.investments);
  const houseEquity = mortgageEquity(input.mortgage);
  const cashVal = cashAccountTotal(input.cash);
  const currentVal = currentAccountTotal(input.current);

  const total =
    superVal + ukVal + investVal + houseEquity + cashVal + currentVal;
  const liquid = total - superVal - houseEquity;

  return {
    super: superVal,
    uk: ukVal,
    investments: investVal,
    houseEquity,
    cash: cashVal,
    current: currentVal,
    total,
    liquid
  };
}

// ============================================================
// Excel date conversion utilities
// ============================================================
export function excelDateToTimestamp(excelDate: number): number {
  const MS_PER_DAY = 86400000;
  const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)).getTime();
  return EXCEL_EPOCH + excelDate * MS_PER_DAY;
}

export function timestampToExcelDate(timestamp: number): number {
  const MS_PER_DAY = 86400000;
  const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)).getTime();
  return (timestamp - EXCEL_EPOCH) / MS_PER_DAY;
}
