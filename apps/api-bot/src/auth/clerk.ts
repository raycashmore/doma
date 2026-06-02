import { createClerkClient } from '@clerk/backend';

import type { BotConfig } from '../config.js';

export type ClerkAuthResult = {
  userId: string;
};

export async function authenticateClerkRequest(request: Request, config: BotConfig): Promise<ClerkAuthResult | null> {
  const clerk = createClerkClient({
    secretKey: config.clerkSecretKey,
    publishableKey: config.clerkPublishableKey
  });

  const auth = await clerk.authenticateRequest(request, {
    authorizedParties: [config.appOrigin]
  });

  if (!auth.isAuthenticated) {
    return null;
  }

  const userId = auth.toAuth().userId;

  return userId ? { userId } : null;
}
