import { v } from 'convex/values';

import { mutation } from '../_generated/server';
import { attachmentMetadataValidator, emailProviderValidator } from './schema';

const rawBodyRetentionMs = 30 * 24 * 60 * 60 * 1_000;
const metadataRetentionMs = 90 * 24 * 60 * 60 * 1_000;

type TestableIndexBuilder = {
  eq(field: string, value: unknown): TestableIndexBuilder;
};

export type CapturedEmailMutationCtx = {
  db: {
    insert(table: 'capturedEmails', row: Record<string, unknown>): Promise<string>;
    query(table: 'capturedEmails'): {
      withIndex(
        index: string,
        apply: (q: TestableIndexBuilder) => TestableIndexBuilder
      ): {
        unique(): Promise<(Record<string, unknown> & { _id: string }) | null>;
      };
    };
  };
};

export type ForwardedEmailCaptureInput = {
  provider: 'resend';
  providerMessageId: string;
  receivedAt: number;
  from: {
    email: string;
    label?: string;
  };
  to: string[];
  subject: string;
  textBody: string;
  htmlBody?: string;
  hasAttachments: boolean;
  attachmentMetadata: Array<{
    filename?: string;
    contentType?: string;
  }>;
};

function assertAuthorizedServiceToken(serviceToken: string) {
  const expectedToken = process.env.BOT_SERVICE_TOKEN;
  if (!expectedToken || serviceToken !== expectedToken) {
    throw new Error('Unauthorized');
  }
}

function normalizeFingerprintPart(value: string) {
  return value.trim().toLowerCase().replace(/\s+/gu, ' ');
}

export function forwardedEmailFingerprint(email: ForwardedEmailCaptureInput) {
  return [
    email.provider,
    normalizeFingerprintPart(email.from.email),
    normalizeFingerprintPart(email.subject),
    normalizeFingerprintPart(email.textBody)
  ].join('|');
}

export async function captureForwardedEmailForBotHandler(
  ctx: CapturedEmailMutationCtx,
  {
    serviceToken,
    capturedAt,
    email
  }: {
    serviceToken: string;
    capturedAt: number;
    email: ForwardedEmailCaptureInput;
  }
) {
  assertAuthorizedServiceToken(serviceToken);

  const existingByProviderMessage = await ctx.db
    .query('capturedEmails')
    .withIndex('by_provider_message', (q) =>
      q.eq('provider', email.provider).eq('providerMessageId', email.providerMessageId)
    )
    .unique();

  if (existingByProviderMessage) {
    return {
      status: 'duplicate' as const,
      capturedEmailId: existingByProviderMessage._id
    };
  }

  const messageFingerprint = forwardedEmailFingerprint(email);
  const existingByFingerprint = await ctx.db
    .query('capturedEmails')
    .withIndex('by_fingerprint', (q) => q.eq('messageFingerprint', messageFingerprint))
    .unique();

  if (existingByFingerprint) {
    return {
      status: 'duplicate' as const,
      capturedEmailId: existingByFingerprint._id
    };
  }

  const id = await ctx.db.insert('capturedEmails', {
    provider: email.provider,
    providerMessageId: email.providerMessageId,
    messageFingerprint,
    fromEmail: normalizeFingerprintPart(email.from.email),
    ...(email.from.label ? { fromLabel: email.from.label } : {}),
    toEmails: email.to.map(normalizeFingerprintPart),
    subject: email.subject,
    textBody: email.textBody,
    ...(email.htmlBody ? { htmlBody: email.htmlBody } : {}),
    hasAttachments: email.hasAttachments,
    attachmentMetadata: email.attachmentMetadata,
    processingState: 'pending',
    receivedAt: email.receivedAt,
    capturedAt,
    updatedAt: capturedAt,
    rawBodyExpiresAt: capturedAt + rawBodyRetentionMs,
    metadataExpiresAt: capturedAt + metadataRetentionMs
  });

  return {
    status: 'created' as const,
    capturedEmailId: id
  };
}

export const captureForwardedEmailForBot = mutation({
  args: {
    serviceToken: v.string(),
    capturedAt: v.number(),
    email: v.object({
      provider: emailProviderValidator,
      providerMessageId: v.string(),
      receivedAt: v.number(),
      from: v.object({
        email: v.string(),
        label: v.optional(v.string())
      }),
      to: v.array(v.string()),
      subject: v.string(),
      textBody: v.string(),
      htmlBody: v.optional(v.string()),
      hasAttachments: v.boolean(),
      attachmentMetadata: v.array(attachmentMetadataValidator)
    })
  },
  handler: (ctx, args) => captureForwardedEmailForBotHandler(ctx as unknown as CapturedEmailMutationCtx, args)
});
