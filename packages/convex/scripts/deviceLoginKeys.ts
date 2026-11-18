import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as dotenv from 'dotenv';

// Sets the device login keys on a Convex deployment without ever printing them. Values are read
// and written through the Convex CLI's pipes, never echoed. See docs/auth.md#device-login.
//
//   setup     first key pair, plus (dev only) CLERK_SECRET_KEY copied from the root env file
//   rotate    new key pair: the public key joins DEVICE_JWT_JWKS, the private key waits in
//             DEVICE_JWT_NEXT_PRIVATE_KEY. Push functions afterwards: auth.config.ts reads the
//             public keys at deploy time.
//   activate  after that push, signs with the new key. Tokens signed with the old one still
//             pass for their remaining hour, so nobody is signed out.
//
// Add --prod to target production. Only the owner runs it with --prod.

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const convexBin = path.resolve(packageDir, 'node_modules/.bin/convex');

/** Errors this script writes itself. Any other error's text could quote a value, so it is never shown. */
class KeyScriptError extends Error {}

type PublicJwk = JsonWebKey & { kid: string; alg: 'ES256'; use: 'sig' };
export type KeyPair = { kid: string; privateJwk: string; publicJwk: PublicJwk };

export async function createKeyPair(now = new Date()): Promise<KeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const suffix = Buffer.from(crypto.getRandomValues(new Uint8Array(4))).toString('hex');
  const kid = `device-${now.toISOString().slice(0, 10)}-${suffix}`;
  const privateJwk = { ...(await crypto.subtle.exportKey('jwk', pair.privateKey)), kid };
  const { kty, crv, x, y } = await crypto.subtle.exportKey('jwk', pair.publicKey);
  return { kid, privateJwk: JSON.stringify(privateJwk), publicJwk: { kty, crv, x, y, kid, alg: 'ES256', use: 'sig' } };
}

/**
 * The public key set after adding `next`: the key currently signing stays, so its tokens keep
 * passing, and any older key is dropped.
 */
export function nextJwks(currentJwks: string | undefined, currentKid: string | undefined, next: PublicJwk) {
  const current = currentJwks ? (JSON.parse(currentJwks) as { keys: PublicJwk[] }).keys : [];
  const kept = current.filter((key) => key.kid === currentKid);
  return JSON.stringify({ keys: [...kept, next] });
}

function convex(args: string[], options: { prod: boolean; input?: string }) {
  const fileEnv = dotenv.parse(readFileSync(path.resolve(packageDir, '../../.env.local')));
  return execFileSync(convexBin, [...args, ...(options.prod ? ['--prod'] : [])], {
    cwd: packageDir,
    env: { ...process.env, CONVEX_DEPLOYMENT: fileEnv['CONVEX_DEPLOYMENT'] },
    input: options.input,
    // Captured, never shown: the CLI's own output can contain the value.
    stdio: ['pipe', 'pipe', 'pipe'],
    encoding: 'utf8'
  });
}

function readEnv(name: string, prod: boolean) {
  try {
    const value = convex(['env', 'get', name], { prod }).trim();
    return value || undefined;
  } catch {
    return undefined;
  }
}

function setEnv(name: string, value: string, prod: boolean) {
  try {
    convex(['env', 'set', name], { prod, input: value });
  } catch {
    // The CLI's error text could include the value, so it is not passed on.
    throw new KeyScriptError(`Could not set ${name}. Check the Convex CLI login and deployment.`);
  }
  console.log(`Set ${name}`);
}

function removeEnv(name: string, prod: boolean) {
  convex(['env', 'remove', name], { prod });
  console.log(`Removed ${name}`);
}

function kidOf(privateJwk: string | undefined) {
  if (!privateJwk) return undefined;
  try {
    return (JSON.parse(privateJwk) as { kid?: string }).kid;
  } catch {
    throw new KeyScriptError('DEVICE_JWT_PRIVATE_KEY is not JSON.');
  }
}

async function main(command: string | undefined, prod: boolean) {
  const target = prod ? 'production' : 'the local development deployment';
  if (command === 'setup') {
    if (readEnv('DEVICE_JWT_PRIVATE_KEY', prod)) throw new KeyScriptError('A signing key is already set. Use rotate.');
    const pair = await createKeyPair();
    setEnv('DEVICE_JWT_JWKS', nextJwks(undefined, undefined, pair.publicJwk), prod);
    setEnv('DEVICE_JWT_PRIVATE_KEY', pair.privateJwk, prod);
    if (!prod) {
      const clerkKey = dotenv.parse(readFileSync(path.resolve(packageDir, '../../.env.local')))['CLERK_SECRET_KEY'];
      if (!clerkKey?.startsWith('sk_test_'))
        throw new KeyScriptError('The root env file has no Clerk development secret key.');
      setEnv('CLERK_SECRET_KEY', clerkKey, prod);
    } else if (!readEnv('CLERK_SECRET_KEY', prod)) {
      console.log('Production has no CLERK_SECRET_KEY. Copy the live secret key from the Clerk dashboard, then run:');
      console.log('  pbpaste | npx convex env set CLERK_SECRET_KEY --prod');
    }
    console.log(`Device login keys set on ${target}. Push functions so auth.config.ts reads the public key.`);
    return;
  }
  if (command === 'rotate') {
    const currentKid = kidOf(readEnv('DEVICE_JWT_PRIVATE_KEY', prod));
    if (!currentKid) throw new KeyScriptError('No signing key is set. Use setup.');
    const pair = await createKeyPair();
    setEnv('DEVICE_JWT_JWKS', nextJwks(readEnv('DEVICE_JWT_JWKS', prod), currentKid, pair.publicJwk), prod);
    setEnv('DEVICE_JWT_NEXT_PRIVATE_KEY', pair.privateJwk, prod);
    console.log(`New key added on ${target}. Push functions, then run activate.`);
    return;
  }
  if (command === 'activate') {
    const next = readEnv('DEVICE_JWT_NEXT_PRIVATE_KEY', prod);
    if (!next) throw new KeyScriptError('No key is waiting. Run rotate first.');
    setEnv('DEVICE_JWT_PRIVATE_KEY', next, prod);
    removeEnv('DEVICE_JWT_NEXT_PRIVATE_KEY', prod);
    console.log(`Device tokens on ${target} are now signed with the new key.`);
    return;
  }
  throw new KeyScriptError('Usage: device-login:keys <setup|rotate|activate> [--prod]');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2).filter((arg) => arg !== '--');
  main(
    args.find((arg) => !arg.startsWith('--')),
    args.includes('--prod')
  ).catch((error: unknown) => {
    console.error(error instanceof KeyScriptError ? error.message : 'Device login key script failed.');
    process.exit(1);
  });
}
