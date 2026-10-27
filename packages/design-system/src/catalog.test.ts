import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { catalogFiles, loadPatterns } from './catalog.ts';
import { run } from './cli.ts';
import { localFile } from './files.ts';
import { guidePages } from './pages.ts';
import { checkoutRevision, repositoryRoot } from './revision.ts';
import type { Pattern } from './schema.ts';

const contractPath = 'packages/design-system/patterns/list-overview-and-access/contract.json';
function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'doma-guide-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ['packages/tokens/source', 'packages/design-system/patterns', 'packages/design-system/guidance'])
    cpSync(path.join(repositoryRoot, dir), path.join(root, dir), { recursive: true });
  cpSync(path.join(repositoryRoot, 'packages/tokens/profile.json'), path.join(root, 'packages/tokens/profile.json'));
  const original = loadPatterns(repositoryRoot)[0]!.contract;
  for (const ref of original.implementations.flatMap((i) => [...i.sourcePaths, ...i.testPaths])) {
    const filename = path.join(root, ref);
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(filename, '// generic source-path fixture\n');
  }
  const update = (fn: (contract: Pattern) => void) => {
    const contract = JSON.parse(readFileSync(path.join(root, contractPath), 'utf8')) as Pattern;
    fn(contract);
    writeFileSync(path.join(root, contractPath), JSON.stringify(contract));
  };
  return { root, update };
}
test('catalog generation is deterministic, timestamp-free and shared by local and human discovery', (t) => {
  const { root } = fixture(t);
  run('generate', root);
  const before = catalogFiles(loadPatterns(root));
  run('generate', root);
  run('check', root);
  assert.deepEqual(catalogFiles(loadPatterns(root)), before);
  const json = JSON.parse(before['catalog.json']!) as { patterns: { status: string; guidePath: string }[] };
  assert.equal(json.patterns[0]?.status, 'proposed');
  assert.equal(json.patterns[0]?.guidePath, contractPath.replace('contract.json', 'guide.md'));
  assert.doesNotMatch(before['catalog.json']!, /timestamp|generatedAt/);
  const pages = guidePages(root, loadPatterns(root), `${'a'.repeat(40)}-dirty`);
  assert.match(pages['patterns/list-overview-and-access.md']!, /This list is unavailable/);
  assert.match(pages['patterns/list-overview-and-access.md']!, /local draft path/);
  assert.doesNotMatch(pages['patterns/list-overview-and-access.md']!, /github.com/);
  const clean = guidePages(root, loadPatterns(root), 'a'.repeat(40));
  assert.match(clean['patterns/list-overview-and-access.md']!, /github.com\/raycashmore\/doma\/blob\/a{40}\/apps\//);
});
for (const failure of ['stale', 'missing', 'extra'] as const)
  test(`check rejects ${failure} artifacts without repair`, (t) => {
    const { root } = fixture(t);
    run('generate', root);
    const catalog = path.join(root, 'packages/design-system/generated/catalog.json');
    if (failure === 'stale') writeFileSync(catalog, 'stale\n');
    if (failure === 'missing') rmSync(catalog);
    if (failure === 'extra') writeFileSync(path.join(root, 'packages/design-system/generated/unexpected.json'), '{}');
    assert.throws(() => run('check', root), /Stale|Missing or extra/);
    if (failure === 'stale') assert.equal(readFileSync(catalog, 'utf8'), 'stale\n');
  });
test('CLI exits unsuccessfully for a stale catalog', (t) => {
  const { root } = fixture(t);
  run('generate', root);
  writeFileSync(path.join(root, 'packages/design-system/generated/catalog.md'), 'old');
  const result = spawnSync(
    process.execPath,
    [
      '--import',
      'tsx',
      '--input-type=module',
      '-e',
      `import { run } from './src/cli.ts'; run('check', process.argv[1]);`,
      root
    ],
    { cwd: path.join(repositoryRoot, 'packages/design-system'), encoding: 'utf8' }
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Stale catalog.md/);
});
const invalidContracts: [string, (c: Pattern) => void, RegExp][] = [
  ['unknown field', (c) => Object.assign(c, { unused: true }), /Invalid pattern/],
  ['unknown rule', (c) => c.implementations[0]!.ruleIds.push('invented'), /Unknown\/inapplicable rule/],
  ['unknown state', (c) => c.implementations[0]!.stateIds.push('invented'), /Unknown state/],
  [
    'unknown token',
    (c) => {
      c.tokenRoles[0]!.id = 'invented';
    },
    /Unknown token role/
  ],
  ['duplicate role', (c) => c.roles.push(c.roles[0]!), /Duplicate roles/],
  [
    'traversal',
    (c) => {
      c.implementations[0]!.sourcePaths[0] = '../private.txt';
    },
    /Unsafe repository path/
  ],
  [
    'missing source',
    (c) => {
      c.implementations[0]!.sourcePaths[0] = 'missing.ts';
    },
    /ENOENT/
  ],
  ['wrong platform rule', (c) => c.implementations[0]!.ruleIds.push('freshness'), /Unknown\/inapplicable rule/]
];
for (const [name, change, error] of invalidContracts)
  test(`validation rejects ${name}`, (t) => {
    const { root, update } = fixture(t);
    update(change);
    assert.throws(() => run('generate', root), error);
  });
test('native deletion fails even when catalog bytes are unchanged', (t) => {
  const { root } = fixture(t);
  run('generate', root);
  const ref = loadPatterns(root)[0]!.contract.implementations[0]!.sourcePaths[0]!;
  rmSync(path.join(root, ref));
  assert.throws(() => run('check', root), /ENOENT/);
});
test('repository references cannot escape through a symlink', (t) => {
  const { root } = fixture(t);
  symlinkSync(repositoryRoot, path.join(root, 'outside'));
  assert.throws(() => localFile(root, 'outside/package.json'), /Invalid repository file/);
});
test('real design references require an existing dedicated-file node and asset', (t) => {
  const { root, update } = fixture(t);
  mkdirSync(path.join(root, 'design'));
  writeFileSync(path.join(root, 'design/design-system.pen'), JSON.stringify({ children: [{ id: 'web-populated' }] }));
  writeFileSync(path.join(root, 'design/example.svg'), '<svg xmlns="http://www.w3.org/2000/svg"/>');
  update((c) =>
    c.designReferences.push({
      path: 'design/design-system.pen',
      nodeIds: ['missing-node'],
      assetPaths: ['design/example.svg'],
      illustrative: true
    })
  );
  assert.throws(() => run('generate', root), /Missing Pencil node/);
  update((c) => {
    c.designReferences[0]!.nodeIds = ['web-populated'];
  });
  run('generate', root);
  rmSync(path.join(root, 'design/example.svg'));
  assert.throws(() => run('check', root), /ENOENT/);
});
test('token references reject unknown aliases, cycles and incompatible values', (t) => {
  const { root } = fixture(t);
  const filename = path.join(root, 'packages/tokens/source/web.json');
  writeFileSync(
    filename,
    JSON.stringify({ color: { content: { primary: { $type: 'color', $value: '{color.content.primary}' } } } })
  );
  assert.throws(() => loadPatterns(root), /cycle/);
  writeFileSync(filename, JSON.stringify({ color: { content: { primary: { $type: 'color', $value: '{unknown}' } } } }));
  assert.throws(() => loadPatterns(root), /type mismatch/);
  writeFileSync(
    filename,
    JSON.stringify({ color: { content: { primary: { $type: 'dimension', $value: { value: 2, unit: 'rem' } } } } })
  );
  assert.throws(() => loadPatterns(root), /Unsupported layout dimension/);
});
test('a supplied build revision must match the real checkout', () => {
  const previous = process.env.DESIGN_GUIDE_REVISION;
  process.env.DESIGN_GUIDE_REVISION = 'not-the-checkout';
  try {
    assert.throws(() => checkoutRevision(repositoryRoot), /does not match/);
  } finally {
    if (previous === undefined) delete process.env.DESIGN_GUIDE_REVISION;
    else process.env.DESIGN_GUIDE_REVISION = previous;
  }
});
test('revision labels distinguish clean commits from dirty local drafts', (t) => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'doma-revision-test-'));
  t.after(() => rmSync(root, { force: true, recursive: true }));
  const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
  git('init', '-q');
  writeFileSync(path.join(root, 'example.md'), 'Generic example');
  git('add', 'example.md');
  git(
    '-c',
    'user.name=Example',
    '-c',
    'user.email=example@example.com',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-qm',
    'Example'
  );
  assert.equal(checkoutRevision(root), git('rev-parse', 'HEAD'));
  writeFileSync(path.join(root, 'example.md'), 'Changed');
  assert.match(checkoutRevision(root), /-dirty$/);
});
