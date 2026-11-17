import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as dotenv from 'dotenv';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// The Convex CLI prefers these over CONVEX_DEPLOYMENT, so any of them could redirect the upload.
const OVERRIDING_KEYS = ['CONVEX_DEPLOY_KEY', 'CONVEX_SELF_HOSTED_URL', 'CONVEX_SELF_HOSTED_ADMIN_KEY'];

// `convex codegen` uploads the functions to the deployment it targets, so it only ever runs against
// the local backend named in the root env file.
export function codegenEnv(fileEnv: Record<string, string>, shellEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const deployment = fileEnv['CONVEX_DEPLOYMENT'];
  if (!deployment?.startsWith('local:')) {
    throw new Error(
      `Refusing to run codegen: CONVEX_DEPLOYMENT in the root env file is ${deployment ? 'not a local deployment' : 'unset'}.`
    );
  }
  const overriding = OVERRIDING_KEYS.filter((key) => shellEnv[key] || fileEnv[key]);
  if (overriding.length > 0) {
    throw new Error(`Refusing to run codegen: ${overriding.join(', ')} would override the local deployment.`);
  }
  return { ...shellEnv, CONVEX_DEPLOYMENT: deployment };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const fileEnv = dotenv.parse(readFileSync(path.resolve(packageDir, '../../.env.local')));
  execFileSync(path.resolve(packageDir, 'node_modules/.bin/convex'), ['codegen'], {
    cwd: packageDir,
    env: codegenEnv(fileEnv, process.env),
    stdio: 'inherit'
  });
}
