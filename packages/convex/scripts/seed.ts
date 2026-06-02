/**
 * Seed @repo/convex from CREAM.xlsx.
 *
 * Run with: pnpm --filter @repo/convex seed
 *       or: pnpm seed   (root convenience alias)
 *       or: pnpm seed:url -- https://<preview>.convex.cloud
 *
 * Uses the first positional argument, or loads env from ../../.env.local
 * (CONVEX_URL or NEXT_PUBLIC_CONVEX_URL or VITE_CONVEX_URL).
 * Every money column is converted to integer cents via toCents().
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { api } from '@repo/convex';
import { toCents } from '@repo/convex/helpers';
import { ConvexHttpClient } from 'convex/browser';
import XLSX from 'xlsx';

import { budgetCaptureDatesFromCaptureDate } from '../convex/budgetDisplayMonth';
import { parseSpendingSummaryRows } from '../convex/spendingSummary';
import { getTargetConvexUrl } from './targetUrl';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const client = new ConvexHttpClient(getTargetConvexUrl());
const XLSX_PATH = path.resolve(__dirname, 'CREAM.xlsx');

function excelDateToTimestamp(excelDate: number): number {
  const MS_PER_DAY = 86400000;
  const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)).getTime();
  return EXCEL_EPOCH + excelDate * MS_PER_DAY;
}

function num(val: unknown): number {
  if (val === '' || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function optNum(val: unknown): number | undefined {
  if (val === '' || val === null || val === undefined) return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

type BudgetRow = {
  date: number;
  captureDate: number;
  incomePrimary: number;
  incomeSecondary: number;
  billContrib: number;
  credit2: number;
  credit1: number;
  credit3: number;
  oneOffs: number;
  sharedOut: number;
  rent: number;
};

type MortgageFields = {
  date: number;
  captureDate: number;
  fixedPayment: number;
  variablePayment: number;
  rateVar?: number;
  rateFixed?: number;
};

function readBudgetRows(wb: XLSX.WorkBook): {
  budgetRows: BudgetRow[];
  mortgageFieldsByDate: MortgageFields[];
} {
  const ws = wb.Sheets['Sink or Swim'];
  const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
  // Columns: Date(0) | Credit 2(1) | Credit 1(2) | Spend(3=derived) | Sink or swim(4) |
  //          Income Primary(5) | Income Secondary(6) | Variable(7) | Fixed(8) | Rent(9) |
  //          Rate Var(10) | Rate Fixed(11) | blank(12) | Credit 3(13) |
  //          One-offs(14) | Shared Out(15) | Bill Contrib(16) |
  //          IN(17=derived) | OUT(18=derived) | NET(19=derived)
  const budgetRows: BudgetRow[] = [];
  const mortgageFieldsByDate: MortgageFields[] = [];

  for (const r of data.slice(1)) {
    if (!r[0] || typeof r[0] !== 'number') continue;
    const captureDate = excelDateToTimestamp(num(r[0]));
    const dates = budgetCaptureDatesFromCaptureDate(captureDate);
    budgetRows.push({
      ...dates,
      incomePrimary: toCents(num(r[5])),
      incomeSecondary: toCents(num(r[6])),
      billContrib: toCents(num(r[16])),
      credit2: toCents(num(r[1])),
      credit1: toCents(num(r[2])),
      credit3: toCents(num(r[13])),
      oneOffs: toCents(num(r[14])),
      sharedOut: toCents(num(r[15])),
      rent: toCents(num(r[9]))
    });
    mortgageFieldsByDate.push({
      ...dates,
      fixedPayment: Math.abs(toCents(num(r[8]))),
      variablePayment: Math.abs(toCents(num(r[7]))),
      rateVar: optNum(r[10]),
      rateFixed: optNum(r[11])
    });
  }

  mortgageFieldsByDate.sort((a, b) => a.date - b.date);
  return { budgetRows, mortgageFieldsByDate };
}

function findMortgageFieldsAtOrBefore(mortgageFields: MortgageFields[], date: number): MortgageFields | undefined {
  let match: MortgageFields | undefined;
  for (const fields of mortgageFields) {
    if (fields.date > date) break;
    match = fields;
  }
  return match;
}

async function main() {
  console.log('Clearing existing tables...');
  for (const table of [
    'currentAccounts',
    'cashAccounts',
    'ukAccounts',
    'superAccounts',
    'investmentAccounts',
    'mortgage',
    'mortgageConfig',
    'budget',
    'spendCategoryBreakdown',
    'cryptoTransactions',
    'cryptoSummaries'
  ] as const) {
    const { deleted } = await client.mutation(api.seed.clearTable, { table });
    console.log(`  cleared ${table}: ${deleted}`);
  }
  console.log('Reading CREAM.xlsx...');
  const wb = XLSX.readFile(XLSX_PATH);
  const { budgetRows, mortgageFieldsByDate } = readBudgetRows(wb);

  // ── Current Accounts ──────────────────────────────────────
  {
    const ws = wb.Sheets['Current'];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    // Columns: Date(0) | Current Secondary(1) | Shared(2) | Current Primary(3) |
    //          Other(4) | Total(5=derived) | Currency(6)
    const rows = data
      .slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === 'number')
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        currentSecondary: toCents(num(r[1])),
        shared: toCents(num(r[2])),
        currentPrimary: toCents(num(r[3])),
        other: toCents(num(r[4])),
        currency: toCents(num(r[6]))
        // r[5] = TOTAL (derived, skip)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedCurrentAccounts, {
        rows: batch
      });
      console.log(`  currentAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  currentAccounts: ${rows.length} total rows`);
  }

  // ── Cash Accounts ─────────────────────────────────────────
  {
    const ws = wb.Sheets['Cash'];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data
      .slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === 'number')
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        saver: toCents(num(r[1])),
        highInterest: toCents(num(r[2]))
        // r[3] = TOTAL (derived, skip)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedCashAccounts, {
        rows: batch
      });
      console.log(`  cashAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  cashAccounts: ${rows.length} total rows`);
  }

  // ── UK Accounts ───────────────────────────────────────────
  {
    const ws = wb.Sheets['UK'];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data
      .slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === 'number')
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        currentGbp: toCents(num(r[1])),
        saverGbp: toCents(num(r[2])),
        cashIsaGbp: toCents(num(r[3])),
        sharesIsaGbp: toCents(num(r[4])),
        // r[5] = TOTAL GBP (derived)
        // r[6] = TOTAL AUD (derived)
        gbpAud: num(r[7])
        // r[8] = AUDGBP (derived)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedUkAccounts, {
        rows: batch
      });
      console.log(`  ukAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  ukAccounts: ${rows.length} total rows`);
  }

  // ── Super Accounts ────────────────────────────────────────
  {
    const ws = wb.Sheets['Super'];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data
      .slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === 'number')
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        pension: toCents(num(r[1])),
        // r[2] = Pension AUD (derived)
        super1: toCents(num(r[3])),
        super2: toCents(num(r[4])),
        super3: toCents(num(r[5])),
        gbpAud: num(r[6])
        // r[7] = TOTAL (derived)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedSuperAccounts, {
        rows: batch
      });
      console.log(`  superAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  superAccounts: ${rows.length} total rows`);
  }

  // ── Investment Accounts ───────────────────────────────────
  {
    const ws = wb.Sheets['Investments'];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data
      .slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === 'number')
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        managedFund1: toCents(num(r[1])),
        investmentLoan: toCents(num(r[2])),
        // r[3] = Managed Fund NET (derived)
        tradingAus1: toCents(num(r[4])),
        tradingInt1: toCents(num(r[5])),
        tradingInt2: toCents(num(r[6])),
        usdAud: num(r[7]),
        managedFund2: toCents(num(r[8])),
        tradingAus2: toCents(num(r[9])),
        managedFund3: toCents(num(r[10])),
        crypto1: toCents(num(r[11])),
        crypto2: toCents(num(r[12]))
        // r[13] = TOTAL (derived)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedInvestmentAccounts, {
        rows: batch
      });
      console.log(`  investmentAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  investmentAccounts: ${rows.length} total rows`);
  }

  // ── Mortgage ──────────────────────────────────────────────
  {
    const ws = wb.Sheets['Mortgage'];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const datedRows = data.slice(1).filter((r: any[]) => r[0] && typeof r[0] === 'number');
    const latestRow = datedRows.reduce<any[] | undefined>((latest, r) => {
      if (!latest) return r;
      return num(r[0]) > num(latest[0]) ? r : latest;
    }, undefined);

    if (latestRow) {
      const result = await client.mutation(api.seed.seedMortgageConfig, {
        config: {
          key: 'default',
          price: toCents(num(latestRow[16])),
          deposit: toCents(num(latestRow[1])),
          familyContrib: toCents(num(latestRow[2])),
          contrib1: toCents(num(latestRow[7])),
          contrib2: toCents(num(latestRow[8])),
          contrib3: toCents(num(latestRow[9])),
          loanValue: 90_000_000
        }
      });
      console.log(`  mortgageConfig: upserted ${result.upserted}`);
    }

    const rows = datedRows.map((r: any[]) => {
      const captureDate = excelDateToTimestamp(num(r[0]));
      const dates = budgetCaptureDatesFromCaptureDate(captureDate);
      const mortgageFields = findMortgageFieldsAtOrBefore(mortgageFieldsByDate, dates.date);
      if (!mortgageFields) {
        throw new Error(
          `Missing Sink or Swim mortgage fields at or before Mortgage row ${new Date(dates.date).toISOString()} (Excel date ${r[0]})`
        );
      }
      return {
        ...dates,
        debt1: toCents(num(r[3])),
        debt2: toCents(num(r[4])),
        fixedPayment: mortgageFields.fixedPayment,
        variablePayment: mortgageFields.variablePayment,
        rateVar: mortgageFields.rateVar,
        rateFixed: mortgageFields.rateFixed,
        offset1: toCents(num(r[10])),
        offset2: toCents(num(r[11]))
      };
    });

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedMortgage, {
        rows: batch
      });
      console.log(`  mortgage: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  mortgage: ${rows.length} total rows`);
  }

  // ── Budget (Sink or Swim) ─────────────────────────────────
  {
    const rows = budgetRows;

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedBudget, {
        rows: batch
      });
      console.log(`  budget: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  budget: ${rows.length} total rows`);
  }

  // ── Spend Category Breakdown (Spending summary) ───────────
  {
    const ws = wb.Sheets['Spending summary'];
    const data = ws ? XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 }) : [];
    const rows = parseSpendingSummaryRows(data);

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedSpendCategoryBreakdown, {
        rows: batch
      });
      console.log(`  spendCategoryBreakdown: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  spendCategoryBreakdown: ${rows.length} total rows`);
  }

  // ── Crypto Transactions ───────────────────────────────────
  {
    const ws = wb.Sheets['Crypto'];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    const txns: Array<{
      platform: 'platform_a' | 'platform_b';
      date?: number;
      type: 'deposit' | 'withdrawal';
      amount: number;
    }> = [];

    // Platform A section: rows after header until "Platform B" label
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r || !r[0]) continue;
      if (typeof r[0] === 'string' && ['Total', 'Value', 'Net'].includes(r[0])) continue;
      if (typeof r[0] === 'string' && r[0] === 'Swyftx') break;

      if (typeof r[0] === 'number' && num(r[1]) > 0) {
        txns.push({
          platform: 'platform_a',
          date: excelDateToTimestamp(num(r[0])),
          type: 'deposit',
          amount: toCents(num(r[1]))
        });
      }
      if (typeof r[0] === 'number' && num(r[2]) > 0) {
        txns.push({
          platform: 'platform_a',
          date: excelDateToTimestamp(num(r[0])),
          type: 'withdrawal',
          amount: toCents(num(r[2]))
        });
      }
    }

    if (txns.length > 0) {
      const result = await client.mutation(api.seed.seedCryptoTransactions, {
        rows: txns
      });
      console.log(`  cryptoTransactions (platform_a): inserted ${result.inserted}`);
    }
    console.log(`  cryptoTransactions: ${txns.length} total rows`);
  }

  // ── Crypto Summaries ──────────────────────────────────────
  {
    const ws = wb.Sheets['Crypto'];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    const summaries: Array<{
      platform: 'platform_a' | 'platform_b';
      totalDeposited: number;
      totalWithdrawn: number;
      currentValue: number;
    }> = [
      {
        platform: 'platform_a',
        totalDeposited: 0,
        totalWithdrawn: 0,
        currentValue: 0
      },
      {
        platform: 'platform_b',
        totalDeposited: 0,
        totalWithdrawn: 0,
        currentValue: 0
      }
    ];

    // Parse summary rows dynamically
    let inPlatformB = false;
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      if (!r) continue;
      if (r[0] === 'Swyftx') {
        inPlatformB = true;
        continue;
      }

      const target = inPlatformB ? summaries[1] : summaries[0];

      if (r[0] === 'Total' && !inPlatformB) {
        target.totalDeposited = toCents(num(r[1]));
        target.totalWithdrawn = toCents(num(r[2]));
      }
      if (r[0] === 'Value' && !inPlatformB && i > 20) {
        target.currentValue = toCents(num(r[2]));
      }
      if (r[0] === 'Deposited Fiat') {
        target.totalDeposited = toCents(num(r[2]));
      }
      if (r[0] === 'Withdrawn Fiat') {
        target.totalWithdrawn = toCents(num(r[2]));
      }
      if (r[0] === 'Value' && inPlatformB) {
        target.currentValue = toCents(num(r[2]));
      }
    }

    const result = await client.mutation(api.seed.seedCryptoSummaries, {
      rows: summaries
    });
    console.log(`  cryptoSummaries: inserted ${result.inserted}`);
  }

  console.log('\nSeed complete!');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
