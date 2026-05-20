import type { Doc } from './_generated/dataModel';

// ============================================================
// CURRENT ACCOUNTS — derived total
// ============================================================
export function currentAccountTotal(row: Doc<'currentAccounts'>) {
  return (
    row.currentSecondary +
    row.shared +
    row.currentPrimary +
    row.other +
    row.currency
  );
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
  return Math.round(ukTotalGbp(row) * row.gbpAud);
}

export function ukAudGbp(row: Doc<'ukAccounts'>) {
  return row.gbpAud === 0 ? 0 : 1 / row.gbpAud;
}

// ============================================================
// SUPER ACCOUNTS — derived fields
// ============================================================
export function superPensionAud(row: Doc<'superAccounts'>) {
  return Math.round(row.pension * row.gbpAud);
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
    Math.round(row.tradingInt2 * row.usdAud) +
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
export type MortgageConfigInput = Pick<
  Doc<'mortgageConfig'>,
  | 'price'
  | 'deposit'
  | 'familyContrib'
  | 'contrib1'
  | 'contrib2'
  | 'contrib3'
  | 'loanValue'
>;

export function mortgageConfigForTotals(
  config: MortgageConfigInput | null | undefined
): MortgageConfigInput {
  return (
    config ?? {
      price: 0,
      deposit: 0,
      familyContrib: 0,
      contrib1: 0,
      contrib2: 0,
      contrib3: 0,
      loanValue: 0
    }
  );
}

export function mortgageTotalDebt(row: Doc<'mortgage'>) {
  return row.debt1 + row.debt2;
}

// ============================================================
// MORTGAGE — static contribution
// ============================================================
export function mortgageContrib(config: MortgageConfigInput): number {
  return config.contrib1 + config.contrib2 + config.contrib3;
}

export function mortgagePaymentTotal(row: Doc<'mortgage'>): number {
  return row.fixedPayment + row.variablePayment;
}

// Stored interest/principal fields were removed. Until a real amortization
// model exists, treat the full payment as interest so derived principal is 0.
export function mortgageInterestPortion(row: Doc<'mortgage'>): number {
  return mortgagePaymentTotal(row);
}

export function mortgagePrincipalPaid(row: Doc<'mortgage'>): number {
  return Math.max(0, mortgagePaymentTotal(row) - mortgageInterestPortion(row));
}

export function mortgageEquity(
  row: Doc<'mortgage'>,
  config: MortgageConfigInput
) {
  return config.price - mortgageTotalDebt(row);
}

// ============================================================
// BUDGET (Sink or Swim) — derived fields
// ============================================================
export function budgetTotalIn(row: Doc<'budget'>) {
  return row.incomePrimary + row.incomeSecondary + row.billContrib;
}

export function budgetTotalOut(row: Doc<'budget'>) {
  return row.credit2 + row.credit1 + row.credit3 + row.oneOffs + row.sharedOut;
}

export function budgetNetGainLoss(row: Doc<'budget'>) {
  return budgetTotalIn(row) - budgetTotalOut(row);
}

// ============================================================
// BUDGET — chart-specific derived fields
// ============================================================
export function budgetSpend(row: Doc<'budget'>) {
  return row.credit2 + row.credit1 + row.credit3 + row.oneOffs;
}

export function budgetSinkOrSwim(
  row: Doc<'budget'>,
  mortgage?: Doc<'mortgage'> | null
) {
  return (
    row.incomePrimary +
    row.incomeSecondary +
    (mortgage?.rateVar ?? 0) +
    (mortgage?.rateFixed ?? 0) +
    row.rent
  );
}

export function budgetMortgagePortion(row: Doc<'mortgage'> | null): number {
  return row ? mortgagePaymentTotal(row) : 0;
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
  mortgageConfig: MortgageConfigInput;
  cash: Doc<'cashAccounts'>;
  current: Doc<'currentAccounts'>;
}

export function computeTotals(input: TotalsInput) {
  const superVal = superTotal(input.super);
  const ukVal = ukTotalAud(input.uk);
  const investVal = investmentTotal(input.investments);
  const houseEquity = mortgageEquity(input.mortgage, input.mortgageConfig);
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

// ============================================================
// Money: integer minor units (cents/pence) conversion
// All money fields in this schema are stored as integer minor
// units. Rates (gbpAud, usdAud, rateVar, rateFixed) stay as floats.
// ============================================================
export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}
