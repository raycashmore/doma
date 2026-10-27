import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { tokenFiles } from './generate.ts';

export const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url));
function inventory(directory: string, prefix = ''): string[] {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const name = `${prefix}${entry.name}`;
      if (entry.isSymbolicLink()) throw new Error(`Unexpected generated symlink ${name}`);
      return entry.isDirectory() ? [name + '/', ...inventory(path.join(directory, entry.name), name + '/')] : [name];
    })
    .sort();
}
export async function run(command: string, root = repositoryRoot): Promise<void> {
  if (!['generate', 'check'].includes(command)) throw new Error('Expected generate or check');
  const expected = await tokenFiles(root);
  const directory = path.join(root, 'packages/tokens/generated');
  const names = Object.keys(expected).sort();
  const directories = [...new Set(names.map((name) => name.split('/')[0] + '/'))];
  const expectedInventory = [...names, ...directories].sort();
  const actual = inventory(directory);
  if (command === 'check' && JSON.stringify(actual) !== JSON.stringify(expectedInventory))
    throw new Error('Missing or extra token artifacts; run @repo/tokens generate');
  if (command === 'generate' && actual.some((name) => !expectedInventory.includes(name)))
    throw new Error('Extra token artifacts; remove unexpected files explicitly');
  for (const [name, contents] of Object.entries(expected)) {
    const filename = path.join(directory, name);
    if (command === 'generate') {
      mkdirSync(path.dirname(filename), { recursive: true });
      writeFileSync(filename, contents);
    } else if (readFileSync(filename, 'utf8') !== contents) throw new Error(`Stale ${name}; run @repo/tokens generate`);
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    await run(process.argv[2] ?? 'check');
    console.log('Token validation passed');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
