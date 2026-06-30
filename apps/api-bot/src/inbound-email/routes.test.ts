import { afterEach, describe, expect, it, vi } from 'vitest';

import { createInboundEmailRoutes } from './routes.js';

describe('inbound email routes', () => {
  const validEvent = {
    type: 'email.received',
    data: {
      email_id: 'resend-email-123',
      from: 'Forwarder <forwarder@example.com>',
      to: ['triage@example.com'],
      subject: 'Library bag tomorrow',
      created_at: '2026-06-30T08:15:00.000Z'
    }
  };
  const validRawBody = JSON.stringify(validEvent);

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('verifies a Resend webhook, fetches the received email body, and captures normalized source material', async () => {
    const captureForwardedEmail = vi.fn(async () => ({
      status: 'created' as const,
      capturedEmailId: 'captured_email_123'
    }));
    const verifyResendWebhookSignature = vi.fn(() => validEvent);
    const fetchResendReceivedEmail = vi.fn(async () => ({
      textBody: 'Please bring a library bag tomorrow.',
      htmlBody: '<p>Please bring a library bag tomorrow.</p>',
      attachments: [{ filename: 'notice.pdf', contentType: 'application/pdf' }]
    }));
    const routes = createInboundEmailRoutes({
      allowedForwardingSenders: ['forwarder@example.com'],
      captureForwardedEmail,
      verifyResendWebhookSignature,
      fetchResendReceivedEmail
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': 'msg_123',
        'svix-timestamp': '1782816900',
        'svix-signature': 'v1,test'
      },
      body: validRawBody
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: 'created',
      capturedEmailId: 'captured_email_123'
    });
    expect(verifyResendWebhookSignature).toHaveBeenCalledWith({
      rawBody: validRawBody,
      headers: expect.any(Headers)
    });
    expect(fetchResendReceivedEmail).toHaveBeenCalledWith('resend-email-123');
    expect(captureForwardedEmail).toHaveBeenCalledWith({
      provider: 'resend',
      providerMessageId: 'resend-email-123',
      receivedAt: Date.parse('2026-06-30T08:15:00.000Z'),
      from: {
        email: 'forwarder@example.com',
        label: 'Forwarder'
      },
      to: ['triage@example.com'],
      subject: 'Library bag tomorrow',
      textBody: 'Please bring a library bag tomorrow.',
      htmlBody: '<p>Please bring a library bag tomorrow.</p>',
      hasAttachments: true,
      attachmentMetadata: [{ filename: 'notice.pdf', contentType: 'application/pdf' }]
    });
  });

  it('rejects invalid webhook signatures before fetching or capturing email content', async () => {
    const captureForwardedEmail = vi.fn();
    const fetchResendReceivedEmail = vi.fn();
    const routes = createInboundEmailRoutes({
      allowedForwardingSenders: ['forwarder@example.com'],
      captureForwardedEmail,
      verifyResendWebhookSignature: vi.fn(() => {
        throw new Error('invalid signature');
      }),
      fetchResendReceivedEmail
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: validRawBody
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_signature' });
    expect(fetchResendReceivedEmail).not.toHaveBeenCalled();
    expect(captureForwardedEmail).not.toHaveBeenCalled();
  });

  it('ignores non-allowlisted forwarding senders before fetching email content', async () => {
    const captureForwardedEmail = vi.fn();
    const fetchResendReceivedEmail = vi.fn();
    const routes = createInboundEmailRoutes({
      allowedForwardingSenders: ['forwarder@example.com'],
      captureForwardedEmail,
      verifyResendWebhookSignature: vi.fn(() => ({
        ...validEvent,
        data: {
          ...validEvent.data,
          from: 'Unknown <unknown@example.com>'
        }
      })),
      fetchResendReceivedEmail
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: validRawBody
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: 'ignored',
      reason: 'sender_not_allowed'
    });
    expect(fetchResendReceivedEmail).not.toHaveBeenCalled();
    expect(captureForwardedEmail).not.toHaveBeenCalled();
  });

  it('rejects malformed Resend event payloads before fetching or capturing email content', async () => {
    const captureForwardedEmail = vi.fn();
    const fetchResendReceivedEmail = vi.fn();
    const routes = createInboundEmailRoutes({
      allowedForwardingSenders: ['forwarder@example.com'],
      captureForwardedEmail,
      verifyResendWebhookSignature: vi.fn(() => ({
        type: 'email.sent',
        data: {}
      })),
      fetchResendReceivedEmail
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: validRawBody
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_email_event' });
    expect(fetchResendReceivedEmail).not.toHaveBeenCalled();
    expect(captureForwardedEmail).not.toHaveBeenCalled();
  });

  it('returns a stable setup error when Resend email content cannot be fetched', async () => {
    const captureForwardedEmail = vi.fn();
    const routes = createInboundEmailRoutes({
      allowedForwardingSenders: ['forwarder@example.com'],
      captureForwardedEmail,
      verifyResendWebhookSignature: vi.fn(() => validEvent),
      fetchResendReceivedEmail: vi.fn(() => {
        throw new Error('not found');
      })
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: validRawBody
    });

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({ error: 'email_body_unavailable' });
    expect(captureForwardedEmail).not.toHaveBeenCalled();
  });

  it('fetches Resend received email content from the documented API endpoint', async () => {
    const captureForwardedEmail = vi.fn(async () => ({
      status: 'created' as const,
      capturedEmailId: 'captured_email_123'
    }));
    const fetch = vi.fn(async () =>
      Response.json({
        html: '<p>Please bring a <strong>library bag</strong> tomorrow.</p>',
        text: null,
        attachments: [
          {
            filename: 'notice.pdf',
            content_type: 'application/pdf'
          }
        ]
      })
    );
    vi.stubGlobal('fetch', fetch);

    const routes = createInboundEmailRoutes({
      resendApiKey: 're_test_key',
      allowedForwardingSenders: ['forwarder@example.com'],
      captureForwardedEmail,
      verifyResendWebhookSignature: vi.fn(() => ({
        ...validEvent,
        data: {
          ...validEvent.data,
          created_at: '2026-06-30T08:15:00.000+00:00'
        }
      }))
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        'content-type': 'application/json'
      },
      body: validRawBody
    });

    expect(response.status).toBe(202);
    expect(fetch).toHaveBeenCalledWith('https://api.resend.com/emails/receiving/resend-email-123', {
      headers: {
        authorization: 'Bearer re_test_key'
      }
    });
    expect(captureForwardedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        receivedAt: Date.parse('2026-06-30T08:15:00.000+00:00'),
        textBody: 'Please bring a library bag tomorrow.',
        htmlBody: '<p>Please bring a <strong>library bag</strong> tomorrow.</p>',
        hasAttachments: true,
        attachmentMetadata: [{ filename: 'notice.pdf', contentType: 'application/pdf' }]
      })
    );
  });
});
