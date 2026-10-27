import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
export function checkoutRevision(root: string): string {
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  const revision = git('rev-parse', 'HEAD');
  const actual = `${revision}${git('status', '--porcelain', '--untracked-files=all') ? '-dirty' : ''}`;
  if (process.env.DESIGN_GUIDE_REVISION && process.env.DESIGN_GUIDE_REVISION !== actual) {
    throw new Error('DESIGN_GUIDE_REVISION does not match the actual checkout');
  }
  return actual;
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1])
  console.log(checkoutRevision(repositoryRoot));
