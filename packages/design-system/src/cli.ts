import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { catalogFiles, loadPatterns } from './catalog.ts';
import { localFile } from './files.ts';
import { guidePages } from './pages.ts';
import { checkoutRevision, repositoryRoot } from './revision.ts';

export function checkArtifacts(directory: string, expected: Record<string, string>): void {
  const actual = existsSync(directory) ? readdirSync(directory).sort() : [];
  if (JSON.stringify(actual) !== JSON.stringify(Object.keys(expected).sort()))
    throw new Error('Missing or extra catalog artifacts; run @repo/design-system generate');
  for (const [name, contents] of Object.entries(expected))
    if (readFileSync(path.join(directory, name), 'utf8') !== contents)
      throw new Error(`Stale ${name}; run @repo/design-system generate`);
}
export function run(command: string, root = repositoryRoot): void {
  const records = loadPatterns(root);
  const expected = catalogFiles(records);
  const generated = path.join(root, 'packages/design-system/generated');
  if (command === 'generate') {
    mkdirSync(generated, { recursive: true });
    for (const [name, contents] of Object.entries(expected)) writeFileSync(path.join(generated, name), contents);
  } else if (command === 'check' || command === 'build') {
    checkArtifacts(generated, expected);
    if (command === 'build') {
      const pages = guidePages(root, records, checkoutRevision(root));
      const output = path.join(root, 'packages/design-system/dist/guide');
      rmSync(output, { force: true, recursive: true });
      for (const asset of new Set(
        records.flatMap(({ contract }) => contract.designReferences.flatMap((ref) => ref.assetPaths))
      )) {
        const destination = path.join(output, 'public/representations', asset);
        mkdirSync(path.dirname(destination), { recursive: true });
        cpSync(localFile(root, asset), destination);
      }
      for (const [name, contents] of Object.entries(pages)) {
        const filename = path.join(output, name);
        mkdirSync(path.dirname(filename), { recursive: true });
        writeFileSync(filename, contents);
      }
    }
  } else throw new Error('Expected generate, check or build');
}
if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  try {
    run(process.argv[2] ?? 'check');
    console.log('Design-system validation passed');
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
