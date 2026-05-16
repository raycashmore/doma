// Convex reads CLERK_JWT_ISSUER_DOMAIN from its dashboard env vars
// (Project → Settings → Environment Variables). Set it to the same value
// as VITE_CLERK_FRONTEND_API_URL. See docs/auth.md.
const issuer = process.env.CLERK_JWT_ISSUER_DOMAIN ?? '';

export default {
  providers: [
    {
      domain: issuer,
      applicationID: 'convex'
    }
  ]
};
