// Device login: a device that signed in with Clerk once keeps a random secret and swaps it for a
// short-lived Convex token signed by this deployment. Nothing here logs or returns secret material:
// secrets, their hashes, tokens and keys stay out of errors and logs (docs/agents/privacy.md).

/** A device unused for this long is refused and deleted. */
export const deviceInactivityLimitMs = 60 * 24 * 60 * 60 * 1000;
/** How long a device token lasts. */
export const deviceTokenLifetimeSeconds = 60 * 60;
/** The audience Convex's auth config requires, shared with the Clerk `convex` template. */
export const deviceTokenAudience = 'convex';

const secretByteLength = 32;
const encoder = new TextEncoder();

/** Thrown when the deployment is missing device login configuration. Names the setting, never a value. */
export class DeviceLoginSetupError extends Error {
  constructor(setting: string) {
    super(`Device login is not set up: ${setting}`);
    this.name = 'DeviceLoginSetupError';
  }
}

function base64url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '');
}

export function createDeviceSecret() {
  return base64url(crypto.getRandomValues(new Uint8Array(secretByteLength)));
}

/** A secret this deployment could have issued: 32 bytes as unpadded base64url. */
export function isWellFormedDeviceSecret(secret: string) {
  return /^[A-Za-z0-9_-]{43}$/.test(secret);
}

export async function hashDeviceSecret(secret: string) {
  return base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(secret))));
}

export function isInactive(lastUsedAt: number, now: number) {
  return now - lastUsedAt > deviceInactivityLimitMs;
}

export type DeviceSigningKey = { kid: string; key: CryptoKey };

type PublicJwks = { keys: Array<{ kid?: unknown }> };

/**
 * Reads the private signing key and checks the public key set holds its `kid`, so a token is never
 * issued that Convex's auth config would reject.
 */
export async function importDeviceSigningKey(
  privateJwk: string | undefined,
  publicJwks: string | undefined
): Promise<DeviceSigningKey> {
  let jwk: JsonWebKey & { kid?: unknown };
  try {
    jwk = JSON.parse(privateJwk ?? '') as JsonWebKey & { kid?: unknown };
  } catch {
    throw new DeviceLoginSetupError('DEVICE_JWT_PRIVATE_KEY is missing or not a JWK');
  }
  if (typeof jwk.kid !== 'string' || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.d) {
    throw new DeviceLoginSetupError('DEVICE_JWT_PRIVATE_KEY is not a P-256 private JWK with a kid');
  }
  let jwks: PublicJwks;
  try {
    jwks = JSON.parse(publicJwks ?? '') as PublicJwks;
  } catch {
    throw new DeviceLoginSetupError('DEVICE_JWT_JWKS is missing or not JSON');
  }
  if (!Array.isArray(jwks.keys) || !jwks.keys.some((key) => key.kid === jwk.kid)) {
    throw new DeviceLoginSetupError('DEVICE_JWT_JWKS does not hold the signing key');
  }
  try {
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
    return { kid: jwk.kid, key };
  } catch {
    throw new DeviceLoginSetupError('DEVICE_JWT_PRIVATE_KEY could not be imported');
  }
}

function encodeJson(value: object) {
  return base64url(encoder.encode(JSON.stringify(value)));
}

/** An ES256 JWT for `userId`, accepted by the `customJwt` provider in `auth.config.ts`. */
export async function signDeviceToken(
  signingKey: DeviceSigningKey,
  claims: { issuer: string; userId: string; now: number }
) {
  const issuedAt = Math.floor(claims.now / 1000);
  const expiresAt = issuedAt + deviceTokenLifetimeSeconds;
  const header = encodeJson({ alg: 'ES256', typ: 'JWT', kid: signingKey.kid });
  const payload = encodeJson({
    iss: claims.issuer,
    sub: claims.userId,
    aud: deviceTokenAudience,
    iat: issuedAt,
    exp: expiresAt
  });
  const signingInput = `${header}.${payload}`;
  // WebCrypto's ECDSA signature is r || s, the form JWS uses for ES256.
  const signature = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    signingKey.key,
    encoder.encode(signingInput)
  );
  return { token: `${signingInput}.${base64url(new Uint8Array(signature))}`, expiresAt: expiresAt * 1000 };
}

/**
 * What Clerk says about a user. `gone` is a definite no (deleted or banned); `unknown` covers
 * anything that may pass, so a Clerk outage never signs a device out.
 */
export type ClerkUserStatus = 'active' | 'gone' | 'unknown';

const clerkTimeoutMs = 5000;

export async function checkClerkUser(
  userId: string,
  secretKey: string | undefined,
  fetchFn: typeof fetch = fetch
): Promise<ClerkUserStatus> {
  if (!secretKey?.startsWith('sk_')) throw new DeviceLoginSetupError('CLERK_SECRET_KEY is missing');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), clerkTimeoutMs);
  let response: Response;
  try {
    response = await fetchFn(`https://api.clerk.com/v1/users/${encodeURIComponent(userId)}`, {
      headers: { Authorization: `Bearer ${secretKey}` },
      signal: controller.signal
    });
  } catch {
    return 'unknown';
  } finally {
    clearTimeout(timeout);
  }
  if (response.status === 404) return 'gone';
  // A rejected key would otherwise fail open forever, so it stops the swap instead.
  if (response.status === 401 || response.status === 403) {
    throw new DeviceLoginSetupError('Clerk rejected CLERK_SECRET_KEY');
  }
  if (!response.ok) return 'unknown';
  try {
    const user = (await response.json()) as { banned?: unknown };
    return user.banned === true ? 'gone' : 'active';
  } catch {
    return 'unknown';
  }
}
