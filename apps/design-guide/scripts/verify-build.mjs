import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

export function verifyBuild(root, revision) {
  const catalog = JSON.parse(readFileSync(path.join(root, 'packages/design-system/generated/catalog.json'), 'utf8'));
  const output = path.join(root, 'apps/design-guide/.vitepress/dist');
  for (const route of [
    'index.html',
    'patterns/index.html',
    'foundations.html',
    'contributing.html',
    ...catalog.patterns.map((pattern) => `patterns/${pattern.id}.html`)
  ]) {
    const html = readFileSync(path.join(output, route), 'utf8');
    assert.ok(html.includes(revision), `Missing checkout revision in ${route}`);
    assert.ok(html.includes('<main'), `Missing guide content in ${route}`);
  }
  for (const pattern of catalog.patterns) {
    const html = readFileSync(path.join(output, `patterns/${pattern.id}.html`), 'utf8');
    for (const required of [
      pattern.title,
      pattern.version,
      pattern.status,
      'Platform mappings and native references',
      'Known gaps:'
    ])
      assert.ok(html.includes(required), `Missing ${required} in ${pattern.id}`);
  }
}
if (process.argv[1] === fileURLToPath(import.meta.url))
  verifyBuild(fileURLToPath(new URL('../../../', import.meta.url)), process.env.DESIGN_GUIDE_REVISION);
