import { createClerkClient } from '@clerk/backend';

import type { AgentConfig } from '../config.js';

export async function authenticateClerkRequest(request: Request, config: AgentConfig) {
  const clerk = createClerkClient({
    secretKey: config.clerkSecretKey,
    publishableKey: config.clerkPublishableKey
  });
  const auth = await clerk.authenticateRequest(request, { authorizedParties: [config.appOrigin] });
  if (!auth.isAuthenticated) return null;
  const userId = auth.toAuth().userId;
  return userId ? { userId } : null;
}
