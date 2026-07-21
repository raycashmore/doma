import { query } from '../_generated/server';
import { readAuthStatus } from '../authStatus';

/** Compatibility endpoint for clients deployed before the shared auth-status query moved. */
export const status = query({
  args: {},
  handler: readAuthStatus
});
