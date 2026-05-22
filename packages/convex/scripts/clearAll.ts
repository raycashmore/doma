/**
 * Clear every seedable table in @repo/convex.
 * Run with: pnpm seed:clear
 *       or: pnpm seed:url:clear -- https://<preview>.convex.cloud
 */

import { ConvexHttpClient } from 'convex/browser';
import { api } from '@repo/convex';
import { getTargetConvexUrl } from './targetUrl';

const client = new ConvexHttpClient(getTargetConvexUrl());

const tables = [
  'currentAccounts',
  'cashAccounts',
  'ukAccounts',
  'superAccounts',
  'investmentAccounts',
  'mortgage',
  'mortgageConfig',
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
