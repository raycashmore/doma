import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

for (const scenario of ['clean', 'existing edits', 'build changes a tracked file']) {
  test(`CI cleanliness guard: ${scenario}`, (t) => {
    const root = mkdtempSync(path.join(os.tmpdir(), 'doma-ci-test-'));
    t.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(path.join(root, 'scripts'));
    mkdirSync(path.join(root, 'bin'));
    copyFileSync(fileURLToPath(new URL('./ci-checks.sh', import.meta.url)), path.join(root, 'scripts/ci-checks.sh'));
    const git = (...args) => {
      const result = spawnSync('git', args, { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
    };
    git('init', '-q');
    writeFileSync(path.join(root, 'fixture.txt'), 'baseline\n');
    git('add', 'fixture.txt');
    git(
      '-c',
      'user.name=Example',
      '-c',
      'user.email=example@example.com',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'Fixture'
    );
    if (scenario === 'existing edits') writeFileSync(path.join(root, 'fixture.txt'), 'local edit\n');
    writeFileSync(
      path.join(root, 'bin/pnpm'),
      `#!/bin/sh
if [ "$1 $2 $3" = "turbo run build" ] && [ "$MUTATE_FIXTURE" = "yes" ]; then
  printf 'build changed this file\\n' > fixture.txt
fi
`
    );
    chmodSync(path.join(root, 'bin/pnpm'), 0o755);
    const result = spawnSync('bash', ['scripts/ci-checks.sh'], {
      cwd: root,
      encoding: 'utf8',
      env: {
        ...process.env,
        PATH: `${path.join(root, 'bin')}${path.delimiter}${process.env.PATH}`,
        MUTATE_FIXTURE: scenario === 'build changes a tracked file' ? 'yes' : 'no'
      }
    });
    if (scenario === 'build changes a tracked file') {
      assert.equal(result.status, 1);
      assert.match(result.stderr, /Verification changed tracked files/);
    } else assert.equal(result.status, 0, result.stderr);
  });
}
