import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env.local') });

export function getTargetConvexUrl(): string {
  const positionalUrl = process.argv.slice(2).find((arg) => arg !== '--');
  const convexUrl =
    positionalUrl ?? process.env.CONVEX_URL ?? process.env.NEXT_PUBLIC_CONVEX_URL ?? process.env.VITE_CONVEX_URL;

  if (!convexUrl) {
    console.error(
      'No Convex URL found. Pass one as the first argument, or set CONVEX_URL, NEXT_PUBLIC_CONVEX_URL, or VITE_CONVEX_URL.'
    );
    process.exit(1);
  }

  try {
    const url = new URL(convexUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Convex URL must use http or https.');
    }
  } catch {
    console.error(`Invalid Convex URL: ${convexUrl}`);
    process.exit(1);
  }

  return convexUrl;
}
