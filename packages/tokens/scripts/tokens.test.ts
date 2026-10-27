import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { repositoryRoot, run } from './cli.ts';
import { tokenFiles } from './generate.ts';
import { loadTokens } from './validate.ts';

function fixture(t: { after: (fn: () => void) => void }) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'doma-tokens-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const directory = path.join(root, 'packages/tokens');
  mkdirSync(directory, { recursive: true });
  cpSync(path.join(repositoryRoot, 'packages/tokens/source'), path.join(directory, 'source'), { recursive: true });
  cpSync(path.join(repositoryRoot, 'packages/tokens/profile.json'), path.join(directory, 'profile.json'));
  const edit = (filename: string, change: (value: Record<string, unknown>) => void) => {
    const file = path.join(directory, filename);
    const value = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    change(value);
    writeFileSync(file, JSON.stringify(value));
  };
  return { root, directory, edit };
}

test('pinned Style Dictionary resolves aliases into deterministic native output and managed desired variables', async (t) => {
  const { root } = fixture(t);
  const files = await tokenFiles(root);
  assert.deepEqual(await tokenFiles(root), files);
  assert.match(files['web/tokens.css']!, /--doma-color-content-primary: #3d2e22;/);
  assert.match(files['web/tokens.css']!, /--doma-space-list-item-content-gap: 8px;/);
  assert.match(files['android/DomaTokens.kt']!, /colorContentPrimary: Long = 0xFF2E1E19/);
  assert.match(files['android/DomaTokens.kt']!, /spaceListItemContentGap: Float = 7.0f/);
  assert.doesNotMatch(Object.values(files).join(''), /generatedAt|timestamp|\{foundation/);
});

for (const platform of ['web', 'android'] as const)
  test(`${platform} foundation edits propagate only to its native output and desired Pencil variables`, async (t) => {
    const { root, edit } = fixture(t);
    const baseline = await tokenFiles(root);
    // Disposable canonical storage: never rewrite the real repository for this proof.
    edit('source/foundation.json', (value) => {
      const foundation = value.foundation as {
        color: Record<string, { $value: { components: number[]; alpha: number } }>;
        space: Record<string, { $value: { value: number } }>;
      };
      foundation.color[`${platform}Primary`]!.$value.components = [0.2, 0.4, 0.6];
      foundation.color[`${platform}Primary`]!.$value.alpha = 0.5;
      foundation.space[`${platform}ListGap`]!.$value.value = 11.5;
    });
    const changed = await tokenFiles(root);
    const native = platform === 'web' ? 'web/tokens.css' : 'android/DomaTokens.kt';
    const other = platform === 'web' ? 'android/DomaTokens.kt' : 'web/tokens.css';
    assert.notEqual(changed[native], baseline[native]);
    assert.equal(changed[other], baseline[other]);
    assert.match(changed[native]!, platform === 'web' ? /#33669980/ : /0x80336699/);
    assert.match(changed[native]!, platform === 'web' ? /11.5px/ : /11.5f/);
    const desired = (text: string) =>
      (JSON.parse(text) as { variables: Record<string, { value: unknown; platform: string }> }).variables;
    const before = desired(baseline['pencil/variables.json']!);
    const after = desired(changed['pencil/variables.json']!);
    for (const [name, variable] of Object.entries(before)) {
      if (variable.platform === platform) assert.notDeepEqual(after[name], variable);
      else assert.deepEqual(after[name], variable);
    }
    // Re-check real committed baseline after disposable proof.
    await run('check');
  });

for (const failure of ['stale', 'missing', 'extra'] as const)
  test(`non-mutating check rejects ${failure} output`, async (t) => {
    const { root, directory } = fixture(t);
    await run('generate', root);
    const file = path.join(directory, 'generated/web/tokens.css');
    if (failure === 'stale') writeFileSync(file, 'stale');
    if (failure === 'missing') rmSync(file);
    if (failure === 'extra') writeFileSync(path.join(directory, 'generated/unexpected.json'), '{}');
    await assert.rejects(run('check', root), /Stale|Missing or extra/);
    if (failure === 'stale') assert.equal(readFileSync(file, 'utf8'), 'stale');
  });

test('generation rejects unexpected output rather than deleting it', async (t) => {
  const { root, directory } = fixture(t);
  await run('generate', root);
  mkdirSync(path.join(directory, 'generated/empty-extra'));
  await assert.rejects(run('generate', root), /Extra/);
});

for (const [name, token, expected] of [
  ['cycle', { $type: 'color', $value: '{color.content.primary}' }, /cycle/],
  ['missing target', { $type: 'color', $value: '{missing}' }, /type mismatch/],
  ['type mismatch', { $type: 'color', $value: '{foundation.space.webListGap}' }, /type mismatch/],
  ['unsupported rem', { $type: 'dimension', $value: { value: 2, unit: 'rem' } }, /Unsupported layout/],
  [
    'unsupported gamut',
    { $type: 'color', $value: { colorSpace: 'display-p3', components: [0, 0, 0], alpha: 1 } },
    /Unsupported sRGB/
  ],
  ['invalid schema', { $type: 'dimension', $value: { value: 2, unit: 'bananas' } }, /Invalid DTCG/],
  ['composite', { $type: 'typography', $value: {} }, /Invalid DTCG|Unsupported token/]
] as const)
  test(`rejects ${name} before generating output`, (t) => {
    const { root, directory } = fixture(t);
    writeFileSync(path.join(directory, 'source/web.json'), JSON.stringify({ color: { content: { primary: token } } }));
    assert.throws(() => loadTokens(root), expected);
  });

test('rejects output-name collisions and unknown profile fields', (t) => {
  const { root, edit } = fixture(t);
  edit('source/web.json', (value) => {
    value.Color = { content: { primary: { $type: 'color', $value: '{foundation.color.webPrimary}' } } };
  });
  assert.throws(() => loadTokens(root), /collision/);
  edit('profile.json', (value) => {
    value.unused = true;
  });
  assert.throws(() => loadTokens(root), /Invalid token profile/);
});

test('legacy public CSS exports and variable declarations remain intact', () => {
  const tokens = readFileSync(path.join(repositoryRoot, 'packages/tokens/tokens.css'), 'utf8');
  const theme = readFileSync(path.join(repositoryRoot, 'packages/tokens/theme.css'), 'utf8');
  assert.match(tokens, /@import '\.\/generated\/web\/tokens.css'/);
  assert.match(tokens, /--warm-text-primary: #3d2e22/);
  assert.match(theme, /--color-warm-text-primary: var\(--warm-text-primary\)/);
});
