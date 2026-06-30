import { Hono } from 'hono';
import { Webhook } from 'svix';
import { z } from 'zod';

import { jsonError } from '../http/json.js';

export type ProviderNeutralCapturedEmail = {
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

export type CaptureForwardedEmail = (
  email: ProviderNeutralCapturedEmail
) => Promise<{ status: 'created' | 'duplicate'; capturedEmailId: string }>;

export type VerifyResendWebhookSignature = (args: { rawBody: string; headers: Headers }) => Promise<unknown> | unknown;

export type FetchResendReceivedEmail = (emailId: string) => Promise<ResendReceivedEmailContent>;

export type CreateInboundEmailRoutesOptions = {
  resendWebhookSecret?: string;
  resendApiKey?: string;
  allowedForwardingSenders: string[];
  captureForwardedEmail: CaptureForwardedEmail;
  verifyResendWebhookSignature?: VerifyResendWebhookSignature;
  fetchResendReceivedEmail?: FetchResendReceivedEmail;
};

export type ResendReceivedEmailContent = {
  textBody: string;
  htmlBody?: string;
  attachments: Array<{
    filename?: string;
    contentType?: string;
  }>;
};

const resendReceivedEventSchema = z.object({
  type: z.literal('email.received'),
  data: z.object({
    email_id: z.string().trim().min(1),
    created_at: z.string().datetime({ offset: true }),
    from: z.string().trim().min(1),
    to: z.array(z.string().trim().email()).min(1),
    subject: z.string().trim().default('')
  })
});

const resendReceivedEmailContentSchema = z
  .object({
    text: z.string().optional().nullable(),
    html: z.string().optional().nullable(),
    attachments: z
      .array(
        z.object({
          filename: z.string().trim().min(1).optional(),
          content_type: z.string().trim().min(1).optional(),
          contentType: z.string().trim().min(1).optional()
        })
      )
      .optional()
  })
  .passthrough();

async function readRawBody(request: Request) {
  try {
    return await request.text();
  } catch {
    return null;
  }
}

function verifyWithSvix(secret: string): VerifyResendWebhookSignature {
  const webhook = new Webhook(secret);

  return ({ rawBody, headers }) => webhook.verify(rawBody, Object.fromEntries(headers.entries()));
}

function normalizeAllowedSenders(allowedForwardingSenders: string[]) {
  return new Set(allowedForwardingSenders.map((sender) => sender.trim().toLowerCase()).filter(Boolean));
}

function parseAddress(value: string) {
  const angleAddress = /^(?<label>.*?)<(?<email>[^<>]+)>$/u.exec(value);
  const email = (angleAddress?.groups?.email ?? value).trim().toLowerCase();
  const label = angleAddress?.groups?.label?.trim().replace(/^"|"$/gu, '');

  return {
    email,
    ...(label ? { label } : {})
  };
}

function htmlToTextFallback(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/giu, ' ')
    .replace(/<script[\s\S]*?<\/script>/giu, ' ')
    .replace(/<[^>]+>/gu, ' ')
    .replace(/&nbsp;/giu, ' ')
    .replace(/&amp;/giu, '&')
    .replace(/&lt;/giu, '<')
    .replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/\s+/gu, ' ')
    .trim();
}

function createResendReceivedEmailFetcher(apiKey: string): FetchResendReceivedEmail {
  return async (emailId) => {
    const response = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: {
        authorization: `Bearer ${apiKey}`
      }
    });

    if (!response.ok) {
      throw new Error(`Resend received email fetch failed with status ${response.status}`);
    }

    const parsed = resendReceivedEmailContentSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new Error('Resend received email response was invalid');
    }

    const textBody = parsed.data.text?.trim() || htmlToTextFallback(parsed.data.html ?? '');
    if (!textBody) {
      throw new Error('Resend received email response did not include body content');
    }

    return {
      textBody,
      ...(parsed.data.html ? { htmlBody: parsed.data.html } : {}),
      attachments: (parsed.data.attachments ?? []).map((attachment) => ({
        ...(attachment.filename ? { filename: attachment.filename } : {}),
        ...(attachment.content_type || attachment.contentType
          ? { contentType: attachment.content_type ?? attachment.contentType }
          : {})
      }))
    };
  };
}

function runtimeVerifyResendWebhookSignature(secret?: string) {
  return secret ? verifyWithSvix(secret) : null;
}

function runtimeFetchResendReceivedEmail(apiKey?: string) {
  return apiKey ? createResendReceivedEmailFetcher(apiKey) : null;
}

export function createInboundEmailRoutes({
  resendWebhookSecret,
  resendApiKey,
  allowedForwardingSenders,
  captureForwardedEmail,
  verifyResendWebhookSignature = runtimeVerifyResendWebhookSignature(resendWebhookSecret) ??
    (() => {
      throw new Error('RESEND_WEBHOOK_SECRET is required for forwarded email capture');
    }),
  fetchResendReceivedEmail = runtimeFetchResendReceivedEmail(resendApiKey) ??
    (() => {
      throw new Error('RESEND_API_KEY is required for forwarded email capture');
    })
}: CreateInboundEmailRoutesOptions) {
  const routes = new Hono();
  const allowedSenders = normalizeAllowedSenders(allowedForwardingSenders);

  routes.post('/resend', async (c) => {
    const rawBody = await readRawBody(c.req.raw);
    if (rawBody === null) {
      return jsonError(c, 400, 'bad_request');
    }

    let verifiedPayload: unknown;
    try {
      verifiedPayload = await verifyResendWebhookSignature({
        rawBody,
        headers: c.req.raw.headers
      });
    } catch {
      return jsonError(c, 401, 'invalid_signature');
    }

    const event = resendReceivedEventSchema.safeParse(verifiedPayload);
    if (!event.success) {
      return jsonError(c, 400, 'invalid_email_event');
    }

    const from = parseAddress(event.data.data.from);
    if (!allowedSenders.has(from.email)) {
      return c.json({ ok: true, status: 'ignored', reason: 'sender_not_allowed' }, 202);
    }

    let content: ResendReceivedEmailContent;
    try {
      content = await fetchResendReceivedEmail(event.data.data.email_id);
    } catch {
      return jsonError(c, 502, 'email_body_unavailable');
    }

    const result = await captureForwardedEmail({
      provider: 'resend',
      providerMessageId: event.data.data.email_id,
      receivedAt: Date.parse(event.data.data.created_at),
      from,
      to: event.data.data.to.map((address) => address.toLowerCase()),
      subject: event.data.data.subject,
      textBody: content.textBody,
      ...(content.htmlBody ? { htmlBody: content.htmlBody } : {}),
      hasAttachments: content.attachments.length > 0,
      attachmentMetadata: content.attachments
    });

    return c.json({ ok: true, ...result }, 202);
  });

  return routes;
}
