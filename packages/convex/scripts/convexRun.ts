import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { FunctionArgs, FunctionReference, FunctionReturnType } from 'convex/server';
import { getFunctionName } from 'convex/server';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageDir = path.resolve(__dirname, '..');

// The seed functions are internal, so they run through the Convex CLI as an admin of the
// deployment rather than over the public HTTP API. With no argument the CLI uses the
// CONVEX_DEPLOYMENT from .env.local. Otherwise the argument is a deployment name, a reference
// such as `prod`, or a https://<name>.convex.cloud URL.
export function targetDeployment(argv: readonly string[]): string | undefined {
  const target = argv.find((arg) => arg !== '--');
  if (target === undefined) return undefined;
  if (!target.includes('://')) return target;

  const match = /^https:\/\/([a-z0-9-]+)\.convex\.cloud\/?$/.exec(target);
  if (!match?.[1]) throw new Error(`Expected a https://<name>.convex.cloud URL, got: ${target}`);
  return match[1];
}

// A named target must never fall back to the local deployment from .env.local.
export function cliEnv(deployment: string | undefined, env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  if (!deployment) return env;
  const childEnv = { ...env };
  delete childEnv['CONVEX_DEPLOYMENT'];
  return childEnv;
}

export function createInternalMutationRunner(argv: readonly string[]) {
  dotenv.config({ path: path.resolve(packageDir, '../../.env.local') });
  const deployment = targetDeployment(argv);
  const env = cliEnv(deployment, process.env);

  return function runInternalMutation<Mutation extends FunctionReference<'mutation', 'internal'>>(
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
      { cwd: packageDir, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] }
    );
    return JSON.parse(output);
  };
}
