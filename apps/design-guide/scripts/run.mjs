import { execFileSync, spawnSync } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

import { verifyBuild } from './verify-build.mjs';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const revision = execFileSync(
  process.execPath,
  ['--experimental-strip-types', 'packages/design-system/src/revision.ts'],
  { cwd: root, encoding: 'utf8' }
).trim();
const env = { ...process.env, DESIGN_GUIDE_REVISION: revision };
function run(args) {
  const result = spawnSync('pnpm', args, { cwd: root, env, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
// Derive the actual checkout before Turbo. Direct package commands and CI use
// the same graph; build tasks are noncached so app-reference deletion is visible.
run(['turbo', 'run', 'build', '--filter=@repo/design-system']);
run([
  '--filter',
  'design-guide',
  'exec',
  'vitepress',
  process.argv[2] ?? 'build',
  ...(process.argv[2] === 'dev' ? ['--host', '127.0.0.1', '--port', '3007', '--strictPort'] : [])
]);

if (process.argv[2] === 'build') verifyBuild(root, revision);
