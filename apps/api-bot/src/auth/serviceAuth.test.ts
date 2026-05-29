import { describe, expect, it } from 'vitest';
import { isAuthorizedServiceRequest } from './serviceAuth.js';

describe('isAuthorizedServiceRequest', () => {
  it('accepts requests with the configured bearer service token', () => {
    const request = new Request('https://api.example.com/webhook', {
      headers: { authorization: 'Bearer service-token' },
    });

    expect(isAuthorizedServiceRequest(request, 'service-token')).toBe(true);
  });

  it('rejects requests without an authorization header', () => {
    const request = new Request('https://api.example.com/webhook');

    expect(isAuthorizedServiceRequest(request, 'service-token')).toBe(false);
  });

  it('rejects requests with the wrong bearer service token', () => {
    const request = new Request('https://api.example.com/webhook', {
      headers: { authorization: 'Bearer wrong-token' },
    });

    expect(isAuthorizedServiceRequest(request, 'service-token')).toBe(false);
  });
});
