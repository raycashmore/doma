/**
 * Clear every seedable table in @repo/convex.
 * Run with: pnpm seed:clear
 *       or: pnpm seed:url:clear -- https://<preview>.convex.cloud
 */

import { internal } from '@repo/convex';

import { runInternalMutation } from './convexRun';

const tables = [
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
] as const;

async function main() {
  for (const table of tables) {
    const { deleted } = runInternalMutation(internal.seed.clearTable, { table });
    console.log(`  ${table}: deleted ${deleted}`);
  }
  console.log('\nClear complete.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
