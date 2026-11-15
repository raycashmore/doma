import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import { getFunctionName } from 'convex/server';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.resolve(packageDir, '../../.env.local') });

// The seed functions are internal, so they run through the Convex CLI as an admin of the
// deployment rather than over the public HTTP API. With no argument the CLI uses the
// CONVEX_DEPLOYMENT from .env.local. Otherwise the argument is a deployment name, a reference
// such as `prod`, or a https://<name>.convex.cloud URL.
export function getTargetDeployment(): string | undefined {
  const target = process.argv.slice(2).find((arg) => arg !== '--');
  if (target === undefined) return undefined;
  if (!target.includes('://')) return target;

  const match = /^https:\/\/([a-z0-9-]+)\.convex\.cloud\/?$/.exec(target);
  if (!match) {
    console.error(`Expected a https://<name>.convex.cloud URL, got: ${target}`);
    process.exit(1);
  }
  return match[1];
}

const deployment = getTargetDeployment();

// A named target must never fall back to the local deployment from .env.local.
function childEnv(): NodeJS.ProcessEnv {
  if (!deployment) return process.env;
  const env = { ...process.env };
  delete env['CONVEX_DEPLOYMENT'];
  return env;
}

export function runInternalMutation<Mutation extends FunctionReference<'mutation', 'internal'>>(
  mutation: Mutation,
  args: FunctionArgs<Mutation>
): FunctionReturnType<Mutation> {
  const output = execFileSync(
    path.resolve(packageDir, 'node_modules/.bin/convex'),
    [
      'run',
      getFunctionName(mutation),
      JSON.stringify(args),
      '--codegen',
      'disable',
      '--typecheck',
      'disable',
      ...(deployment ? ['--deployment', deployment] : [])
    ],
    { cwd: packageDir, env: childEnv(), encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
  );
  return JSON.parse(output);
}
