/**
 * Seed @repo/convex from CREAM.xlsx.
 *
 * Run with: pnpm --filter @repo/convex seed
 *       or: pnpm seed   (root convenience alias)
 *
 * Loads env from ../../.env.local (CONVEX_URL or NEXT_PUBLIC_CONVEX_URL or VITE_CONVEX_URL).
 * Every money column is converted to integer cents via toCents().
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@repo/convex';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used in Task 0.10 cents migration
import { toCents } from '@repo/convex/helpers';
import * as XLSX from 'xlsx';

// Load monorepo root .env.local (must run before reading process.env)
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const CONVEX_URL =
  process.env.CONVEX_URL ??
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  process.env.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error(
    'No CONVEX_URL found. Set CONVEX_URL or NEXT_PUBLIC_CONVEX_URL in .env.local.'
  );
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
const XLSX_PATH = path.resolve(__dirname, 'CREAM.xlsx');

function excelDateToTimestamp(excelDate: number): number {
  const MS_PER_DAY = 86400000;
  const EXCEL_EPOCH = new Date(Date.UTC(1899, 11, 30)).getTime();
  return EXCEL_EPOCH + excelDate * MS_PER_DAY;
}

function num(val: unknown): number {
  if (val === "" || val === null || val === undefined) return 0;
  const n = Number(val);
  return isNaN(n) ? 0 : n;
}

function optNum(val: unknown): number | undefined {
  if (val === "" || val === null || val === undefined) return undefined;
  const n = Number(val);
  return isNaN(n) ? undefined : n;
}

async function main() {
  console.log("Reading CREAM.xlsx...");
  const wb = XLSX.readFile(XLSX_PATH);

  // ── Current Accounts ──────────────────────────────────────
  {
    const ws = wb.Sheets["Current"];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data.slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === "number")
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        currentSecondary: num(r[1]),
        shared: num(r[2]),
        currentPrimary: num(r[3]),
        other: num(r[4]),
        // r[5] = TOTAL (derived, skip)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedCurrentAccounts, { rows: batch });
      console.log(`  currentAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  currentAccounts: ${rows.length} total rows`);
  }

  // ── Cash Accounts ─────────────────────────────────────────
  {
    const ws = wb.Sheets["Cash"];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data.slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === "number")
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        saver: num(r[1]),
        highInterest: num(r[2]),
        // r[3] = TOTAL (derived, skip)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedCashAccounts, { rows: batch });
      console.log(`  cashAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  cashAccounts: ${rows.length} total rows`);
  }

  // ── UK Accounts ───────────────────────────────────────────
  {
    const ws = wb.Sheets["UK"];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data.slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === "number")
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        currentGbp: num(r[1]),
        saverGbp: num(r[2]),
        cashIsaGbp: num(r[3]),
        sharesIsaGbp: num(r[4]),
        // r[5] = TOTAL GBP (derived)
        // r[6] = TOTAL AUD (derived)
        gbpAud: num(r[7]),
        // r[8] = AUDGBP (derived)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedUkAccounts, { rows: batch });
      console.log(`  ukAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  ukAccounts: ${rows.length} total rows`);
  }

  // ── Super Accounts ────────────────────────────────────────
  {
    const ws = wb.Sheets["Super"];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data.slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === "number")
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        pension: num(r[1]),
        // r[2] = Pension AUD (derived)
        super1: num(r[3]),
        super2: num(r[4]),
        super3: num(r[5]),
        gbpAud: num(r[6]),
        // r[7] = TOTAL (derived)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedSuperAccounts, { rows: batch });
      console.log(`  superAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  superAccounts: ${rows.length} total rows`);
  }

  // ── Investment Accounts ───────────────────────────────────
  {
    const ws = wb.Sheets["Investments"];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data.slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === "number")
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        managedFund1: num(r[1]),
        investmentLoan: num(r[2]),
        // r[3] = Managed Fund NET (derived)
        tradingAus1: num(r[4]),
        tradingInt1: num(r[5]),
        tradingInt2: num(r[6]),
        usdAud: num(r[7]),
        managedFund2: num(r[8]),
        tradingAus2: num(r[9]),
        managedFund3: num(r[10]),
        crypto1: num(r[11]),
        crypto2: num(r[12]),
        // r[13] = TOTAL (derived)
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedInvestmentAccounts, { rows: batch });
      console.log(`  investmentAccounts: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  investmentAccounts: ${rows.length} total rows`);
  }

  // ── Mortgage ──────────────────────────────────────────────
  {
    const ws = wb.Sheets["Mortgage"];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    const rows = data.slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === "number")
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        deposit: num(r[1]),
        familyContrib: num(r[2]),
        debt1: num(r[3]),
        debt2: num(r[4]),
        interestCharged: num(r[5]),
        principalPaid: num(r[6]),
        contrib1: num(r[7]),
        contrib2: num(r[8]),
        contrib3: num(r[9]),
        // r[10..15] = Available/My available/Liquid/Equity (derived)
        price: num(r[16]),
        landValue: num(r[17]),
        capitalGrowth: num(r[18]),
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedMortgage, { rows: batch });
      console.log(`  mortgage: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  mortgage: ${rows.length} total rows`);
  }

  // ── Budget (Sink or Swim) ─────────────────────────────────
  {
    const ws = wb.Sheets["Sink or Swim"];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    // Columns: Date(0) | Credit 2(1) | Credit 1(2) | Spend(3=derived) | Sink or swim(4) |
    //          Income Primary(5) | Income Secondary(6) | Variable(7) | Fixed(8) | Rent(9) |
    //          Rate Var(10) | Rate Fix(11) | blank(12) | Credit 3(13) |
    //          One-offs(14) | Shared(15) | Bill Contrib(16) |
    //          IN(17=derived) | OUT(18=derived) | NET(19=derived)
    const rows = data.slice(1)
      .filter((r: any[]) => r[0] && typeof r[0] === "number")
      .map((r: any[]) => ({
        date: excelDateToTimestamp(num(r[0])),
        incomePrimary: num(r[5]),
        incomeSecondary: num(r[6]),
        billContrib: num(r[16]),
        credit2: num(r[1]),
        credit1: num(r[2]),
        credit3: num(r[13]),
        oneOffs: num(r[14]),
        shared: num(r[15]),
        variable: num(r[7]),
        fixed: num(r[8]),
        rent: num(r[9]),
        rateVar: optNum(r[10]),
        rateFix: optNum(r[11]),
      }));

    for (let i = 0; i < rows.length; i += 100) {
      const batch = rows.slice(i, i + 100);
      const result = await client.mutation(api.seed.seedBudget, { rows: batch });
      console.log(`  budget: inserted ${result.inserted} (batch ${Math.floor(i / 100) + 1})`);
    }
    console.log(`  budget: ${rows.length} total rows`);
  }

  // ── Crypto Transactions ───────────────────────────────────
  {
    const ws = wb.Sheets["Crypto"];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    const txns: Array<{
      platform: "platform_a" | "platform_b";
      date?: number;
      type: "deposit" | "withdrawal";
      amount: number;
    }> = [];

    // Platform A section: rows after header until "Platform B" label
    for (let i = 1; i < data.length; i++) {
      const r = data[i];
      if (!r || !r[0]) continue;
      if (typeof r[0] === "string" && ["Total", "Value", "Net"].includes(r[0])) continue;
      if (typeof r[0] === "string" && r[0] === "Swyftx") break;

      if (typeof r[0] === "number" && num(r[1]) > 0) {
        txns.push({
          platform: "platform_a",
          date: excelDateToTimestamp(num(r[0])),
          type: "deposit",
          amount: num(r[1]),
        });
      }
      if (typeof r[0] === "number" && num(r[2]) > 0) {
        txns.push({
          platform: "platform_a",
          date: excelDateToTimestamp(num(r[0])),
          type: "withdrawal",
          amount: num(r[2]),
        });
      }
    }

    if (txns.length > 0) {
      const result = await client.mutation(api.seed.seedCryptoTransactions, { rows: txns });
      console.log(`  cryptoTransactions (platform_a): inserted ${result.inserted}`);
    }
    console.log(`  cryptoTransactions: ${txns.length} total rows`);
  }

  // ── Crypto Summaries ──────────────────────────────────────
  {
    const ws = wb.Sheets["Crypto"];
    const data = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });

    const summaries: Array<{
      platform: "platform_a" | "platform_b";
      totalDeposited: number;
      totalWithdrawn: number;
      currentValue: number;
    }> = [
      { platform: "platform_a", totalDeposited: 0, totalWithdrawn: 0, currentValue: 0 },
      { platform: "platform_b", totalDeposited: 0, totalWithdrawn: 0, currentValue: 0 },
    ];

    // Parse summary rows dynamically
    let inPlatformB = false;
    for (let i = 0; i < data.length; i++) {
      const r = data[i];
      if (!r) continue;
      if (r[0] === "Swyftx") { inPlatformB = true; continue; }

      const target = inPlatformB ? summaries[1] : summaries[0];

      if (r[0] === "Total" && !inPlatformB) {
        target.totalDeposited = num(r[1]);
        target.totalWithdrawn = num(r[2]);
      }
      if (r[0] === "Value" && !inPlatformB && i > 20) {
        target.currentValue = num(r[2]);
      }
      if (r[0] === "Deposited Fiat") {
        target.totalDeposited = num(r[2]);
      }
      if (r[0] === "Withdrawn Fiat") {
        target.totalWithdrawn = num(r[2]);
      }
      if (r[0] === "Value" && inPlatformB) {
        target.currentValue = num(r[2]);
      }
    }

    const result = await client.mutation(api.seed.seedCryptoSummaries, { rows: summaries });
    console.log(`  cryptoSummaries: inserted ${result.inserted}`);
  }

  console.log("\nSeed complete!");
}

main().catch(console.error);
