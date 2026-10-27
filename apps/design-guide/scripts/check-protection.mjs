import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath, URL } from 'node:url';

export function protectionPaths(dist) {
  const files = readdirSync(path.join(dist, 'assets'));
  const chunks = readdirSync(path.join(dist, 'assets/chunks'));
  const app = files.find((name) => /^app\..+\.js$/.test(name));
  const search = chunks.find((name) => /^@localSearchIndexroot\..+\.js$/.test(name));
  if (!app || !search) throw new Error('Build the guide first: app or search asset is missing.');
  const paths = [
    '/',
    '/patterns/list-overview-and-access.html',
    '/representations/design/exports/list-overview-and-access/xez2P.png',
    `/assets/${app}`,
    `/assets/chunks/${search}`
  ];
  for (const route of paths) {
    if (!statSync(path.join(dist, route === '/' ? 'index.html' : route.slice(1))).isFile())
      throw new Error(`Missing built guide file: ${route}`);
  }
  return paths;
}

export function protectedResponse(status, location, body) {
  if (/Build revision:|<main(?:\s|>)/i.test(body)) return false;
  const authenticationBody = body.startsWith('Protected by Vercel Authentication\n');
  if ([401, 403].includes(status)) return authenticationBody;
  if (![302, 303, 307, 308].includes(status) || !authenticationBody) return false;
  try {
    const url = new URL(location);
    return url.origin === 'https://vercel.com' && ['/sso-api', '/sso', '/login'].includes(url.pathname);
  } catch {
    return false;
  }
}

export async function checkProtection(origins, paths, request = globalThis.fetch) {
  if (!origins.length) throw new Error('Supply every assigned production, deployment and preview origin.');
  const hosts = [
    ...new Set(
      origins.map((value) => {
        const url = new URL(value);
        if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash)
          throw new Error('Each target must be an HTTPS origin without credentials, path, query or fragment.');
        return url.origin;
      })
    )
  ];
  return Promise.all(
    hosts.flatMap((origin) =>
      paths.map(async (route) => {
        try {
          const response = await request(`${origin}${route}`, {
            redirect: 'manual',
            credentials: 'omit',
            signal: globalThis.AbortSignal.timeout(10_000)
          });
          const passed = protectedResponse(response.status, response.headers.get('location'), await response.text());
          return { origin, route, status: response.status, passed };
        } catch {
          return { origin, route, status: null, passed: false };
        }
      })
    )
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const dist = fileURLToPath(new URL('../.vitepress/dist', import.meta.url));
    const results = await checkProtection(process.argv.slice(2), protectionPaths(dist));
    console.log(JSON.stringify(results, null, 2));
    if (results.some((result) => !result.passed)) process.exitCode = 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Protection check failed.');
    process.exitCode = 1;
  }
}
import console from 'node:console';
