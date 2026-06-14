import { query } from '../_generated/server';

type AuthStatusCtx = {
  auth: {
    getUserIdentity: () => Promise<{ tokenIdentifier: string; subject: string } | null>;
  };
};

export async function readAuthStatus(ctx: AuthStatusCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error('Not authenticated');

  return {
    isAuthenticated: true,
    userLabel: 'Household user'
  };
}

export const status = query({
  args: {},
  handler: readAuthStatus
});
