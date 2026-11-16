import type { Auth } from 'convex/server';

// Clerk runs in restricted mode, so any signed-in identity is an approved household member.
export async function requireSignedIn(ctx: { auth: Auth }) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');
  return identity;
}
