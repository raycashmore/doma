import { ConvexHttpClient } from 'convex/browser';
import { makeFunctionReference } from 'convex/server';

import type { BotConfig } from '../config.js';
import type { CaptureForwardedEmail, ProviderNeutralCapturedEmail } from './routes.js';

const captureForwardedEmailForBot = makeFunctionReference<
  'mutation',
  {
    serviceToken: string;
    capturedAt: number;
    email: ProviderNeutralCapturedEmail;
  },
  { status: 'created' | 'duplicate'; capturedEmailId: string }
>('email/capture:captureForwardedEmailForBot');

export function createConvexForwardedEmailCapture(config: BotConfig): CaptureForwardedEmail {
  if (!config.convexUrl) {
    throw new Error('CONVEX_URL is required for forwarded email capture');
  }

  const client = new ConvexHttpClient(config.convexUrl);

  return (email) =>
    client.mutation(captureForwardedEmailForBot, {
      serviceToken: config.botServiceToken,
      capturedAt: Date.now(),
      email
    });
}
