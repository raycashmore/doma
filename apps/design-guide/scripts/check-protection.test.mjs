import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';

import { checkProtection, protectedResponse, protectionPaths } from './check-protection.mjs';

const body = 'Protected by Vercel Authentication\n';

test('requires a recognized authentication response, not an application failure or arbitrary redirect', () => {
  assert.equal(protectedResponse(302, 'https://vercel.com/sso-api?nonce=example', body), true);
  assert.equal(protectedResponse(401, null, body), true);
  for (const [status, location, content] of [
    [200, null, body],
    [404, null, body],
    [403, null, 'Forbidden'],
    [302, 'https://evilvercel.com/sso', body],
    [302, 'https://vercel.com/unrelated', body],
    [302, '/login', body],
    [302, 'https://vercel.com/login', 'Guide content'],
    [302, 'https://vercel.com/login', `${body}<main>Build revision: example</main>`]
  ])
    assert.equal(protectedResponse(status, location, content), false);
});

test('checks each explicit origin without cookies or redirect following; network failures fail closed', async () => {
  const calls = [];
  const results = await checkProtection(
    ['https://guide.example', 'https://preview.example'],
    ['/', '/asset.js'],
    async (url, options) => {
      calls.push({ url, options });
      if (url === 'https://preview.example/asset.js') throw new Error('offline');
      return new globalThis.Response(body, { status: 302, headers: { location: 'https://vercel.com/sso-api' } });
    }
  );
  assert.equal(calls.length, 4);
  assert.ok(
    calls.every(({ options }) => options.credentials === 'omit' && options.redirect === 'manual' && !options.headers)
  );
  assert.equal(results.filter((result) => result.passed).length, 3);
  assert.equal(results.at(-1).status, null);
  for (const origins of [
    [],
    ['http://guide.example'],
    ['https://user:secret@guide.example'],
    ['https://guide.example/path'],
    ['https://guide.example/?token=example']
  ])
    await assert.rejects(checkProtection(origins, ['/']));
});

test('selects actual hashed assets and fails before requests if the build is incomplete', (t) => {
  const dist = mkdtempSync(path.join(os.tmpdir(), 'guide-protection-'));
  t.after(() => rmSync(dist, { recursive: true, force: true }));
  for (const name of [
    'index.html',
    'patterns/list-overview-and-access.html',
    'representations/design/exports/list-overview-and-access/xez2P.png',
    'assets/app.example.js',
    'assets/chunks/@localSearchIndexroot.example.js'
  ]) {
    mkdirSync(path.dirname(path.join(dist, name)), { recursive: true });
    writeFileSync(path.join(dist, name), 'example');
  }
  assert.equal(protectionPaths(dist).length, 5);
  assert.ok(protectionPaths(dist).includes('/assets/app.example.js'));
  rmSync(path.join(dist, 'assets/app.example.js'));
  assert.throws(() => protectionPaths(dist), /Build the guide first/);
});
