/**
 * Clear every seedable table in @repo/convex.
 * Run with: pnpm seed:clear
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '@repo/convex';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

const CONVEX_URL =
  process.env.CONVEX_URL ??
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  process.env.VITE_CONVEX_URL;

if (!CONVEX_URL) {
  console.error('No CONVEX_URL found in .env.local.');
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);

const tables = [
  'currentAccounts',
  'cashAccounts',
  'ukAccounts',
  'superAccounts',
  'investmentAccounts',
  'mortgage',
  'budget',
  'cryptoTransactions',
  'cryptoSummaries'
] as const;

async function main() {
  for (const table of tables) {
    const { deleted } = await client.mutation(api.seed.clearTable, { table });
    console.log(`  ${table}: deleted ${deleted}`);
  }
  console.log('\nClear complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
