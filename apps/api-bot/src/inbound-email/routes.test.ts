import { describe, expect, it, vi } from 'vitest';

import { createInboundEmailRoutes } from './routes.js';

describe('inbound email routes', () => {
  const validBody = {
    emailId: 'resend-email-123',
    from: 'Ray <ray@example.com>',
    to: ['triage@example.com'],
    subject: 'Library bag tomorrow',
    text: 'Please bring a library bag tomorrow.',
    html: '<p>Please bring a library bag tomorrow.</p>',
    createdAt: '2026-06-30T08:15:00.000Z',
    attachments: [{ filename: 'notice.pdf', contentType: 'application/pdf' }]
  };

  it('accepts an authenticated Resend-like email from an allowed forwarding sender', async () => {
    const captureForwardedEmail = vi.fn(async () => ({
      status: 'created' as const,
      capturedEmailId: 'captured_email_123'
    }));
    const routes = createInboundEmailRoutes({
      serviceToken: 'service-token',
      allowedForwardingSenders: ['ray@example.com'],
      captureForwardedEmail
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        ...validBody
      })
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: 'created',
      capturedEmailId: 'captured_email_123'
    });
    expect(captureForwardedEmail).toHaveBeenCalledWith({
      provider: 'resend',
      providerMessageId: 'resend-email-123',
      receivedAt: Date.parse('2026-06-30T08:15:00.000Z'),
      from: {
        email: 'ray@example.com',
        label: 'Ray'
      },
      to: ['triage@example.com'],
      subject: 'Library bag tomorrow',
      textBody: 'Please bring a library bag tomorrow.',
      htmlBody: '<p>Please bring a library bag tomorrow.</p>',
      hasAttachments: true,
      attachmentMetadata: [{ filename: 'notice.pdf', contentType: 'application/pdf' }]
    });
  });

  it('rejects unauthenticated webhook requests before capture', async () => {
    const captureForwardedEmail = vi.fn();
    const routes = createInboundEmailRoutes({
      serviceToken: 'service-token',
      allowedForwardingSenders: ['ray@example.com'],
      captureForwardedEmail
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify(validBody)
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'unauthorized' });
    expect(captureForwardedEmail).not.toHaveBeenCalled();
  });

  it('ignores non-allowlisted forwarding senders before capture', async () => {
    const captureForwardedEmail = vi.fn();
    const routes = createInboundEmailRoutes({
      serviceToken: 'service-token',
      allowedForwardingSenders: ['ray@example.com'],
      captureForwardedEmail
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        ...validBody,
        from: 'Unknown <unknown@example.com>'
      })
    });

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      status: 'ignored',
      reason: 'sender_not_allowed'
    });
    expect(captureForwardedEmail).not.toHaveBeenCalled();
  });

  it('rejects malformed provider payloads before capture', async () => {
    const captureForwardedEmail = vi.fn();
    const routes = createInboundEmailRoutes({
      serviceToken: 'service-token',
      allowedForwardingSenders: ['ray@example.com'],
      captureForwardedEmail
    });

    const response = await routes.request('/resend', {
      method: 'POST',
      headers: {
        authorization: 'Bearer service-token',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        ...validBody,
        emailId: ''
      })
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: 'invalid_email' });
    expect(captureForwardedEmail).not.toHaveBeenCalled();
  });
});
