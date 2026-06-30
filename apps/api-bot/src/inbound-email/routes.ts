import { Hono } from 'hono';
import { z } from 'zod';

import { isAuthorizedServiceRequest } from '../auth/serviceAuth.js';
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

export type CreateInboundEmailRoutesOptions = {
  serviceToken: string;
  allowedForwardingSenders: string[];
  captureForwardedEmail: CaptureForwardedEmail;
};

const resendInboundEmailSchema = z.object({
  emailId: z.string().trim().min(1),
  from: z.string().trim().min(1),
  to: z.array(z.string().trim().email()).min(1),
  subject: z.string().trim().default(''),
  text: z.string().trim().min(1),
  html: z.string().optional(),
  createdAt: z.string().datetime(),
  attachments: z
    .array(
      z.object({
        filename: z.string().trim().min(1).optional(),
        contentType: z.string().trim().min(1).optional()
      })
    )
    .optional()
});

async function parseJsonBody(c: { req: { json: <T>() => Promise<T> } }) {
  try {
    return await c.req.json<unknown>();
  } catch {
    return undefined;
  }
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

export function createInboundEmailRoutes({
  serviceToken,
  allowedForwardingSenders,
  captureForwardedEmail
}: CreateInboundEmailRoutesOptions) {
  const routes = new Hono();
  const allowedSenders = normalizeAllowedSenders(allowedForwardingSenders);

  routes.post('/resend', async (c) => {
    if (!isAuthorizedServiceRequest(c.req.raw, serviceToken)) {
      return jsonError(c, 401, 'unauthorized');
    }

    const body = await parseJsonBody(c);
    if (body === undefined) {
      return jsonError(c, 400, 'bad_request');
    }

    const parsed = resendInboundEmailSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(c, 400, 'invalid_email');
    }

    const from = parseAddress(parsed.data.from);
    if (!allowedSenders.has(from.email)) {
      return c.json({ ok: true, status: 'ignored', reason: 'sender_not_allowed' }, 202);
    }

    const attachments = parsed.data.attachments ?? [];
    const result = await captureForwardedEmail({
      provider: 'resend',
      providerMessageId: parsed.data.emailId,
      receivedAt: Date.parse(parsed.data.createdAt),
      from,
      to: parsed.data.to.map((address) => address.toLowerCase()),
      subject: parsed.data.subject,
      textBody: parsed.data.text,
      ...(parsed.data.html ? { htmlBody: parsed.data.html } : {}),
      hasAttachments: attachments.length > 0,
      attachmentMetadata: attachments
    });

    return c.json({ ok: true, ...result }, 202);
  });

  return routes;
}
