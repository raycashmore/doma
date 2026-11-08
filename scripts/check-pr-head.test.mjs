import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = fileURLToPath(new URL('./check-pr-head.sh', import.meta.url));

function repoWithPrHead(t, prHead) {
  const root = mkdtempSync(path.join(os.tmpdir(), 'doma-pr-head-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const git = (...args) => {
    const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  git('init', '-q');
  writeFileSync(path.join(root, 'fixture.txt'), 'baseline\n');
  git('add', 'fixture.txt');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.com', 'commit', '-qm', 'baseline');
  const bin = path.join(os.tmpdir(), path.basename(root) + '-bin');
  mkdirSync(bin);
  t.after(() => rmSync(bin, { recursive: true, force: true }));
  const head = git('rev-parse', 'HEAD');
  writeFileSync(path.join(bin, 'gh'), `#!/bin/sh\necho ${prHead(head)}\n`);
  chmodSync(path.join(bin, 'gh'), 0o755);
  const run = () =>
    spawnSync('bash', [script], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}` }
    });
  return { root, run };
}

test('PR head check passes when the PR matches a clean local head', (t) => {
  const { run } = repoWithPrHead(t, (head) => head);
  assert.equal(run().status, 0);
});

test('PR head check fails when commits are not on the PR', (t) => {
  const { run } = repoWithPrHead(t, () => '0000000000000000000000000000000000000000');
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /is not local head/);
});

test('PR head check fails with uncommitted changes', (t) => {
  const { root, run } = repoWithPrHead(t, (head) => head);
  writeFileSync(path.join(root, 'fixture.txt'), 'edited\n');
  const result = run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Uncommitted changes/);
});
