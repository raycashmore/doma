import type { AuthConfig } from 'convex/server';

// Convex reads these at deploy time from the deployment's env vars (Project → Settings →
// Environment Variables), and refuses to deploy while one is unset. See docs/auth.md.
// CLERK_JWT_ISSUER_DOMAIN: the same value as VITE_CLERK_FRONTEND_API_URL.
// DEVICE_JWT_JWKS: the public keys for device logins (devices/login.ts). Push functions again after
// changing it.
const clerkIssuer = process.env.CLERK_JWT_ISSUER_DOMAIN ?? '';
const deviceJwks = process.env.DEVICE_JWT_JWKS ?? '';

export default {
  providers: [
    {
      domain: clerkIssuer,
      applicationID: 'convex'
    },
    {
      type: 'customJwt',
      applicationID: 'convex',
      issuer: process.env.CONVEX_SITE_URL ?? '',
      jwks: `data:text/plain;charset=utf-8;base64,${btoa(deviceJwks)}`,
      algorithm: 'ES256'
    }
  ]
} satisfies AuthConfig;
