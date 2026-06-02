import { describe, expect, it } from 'vitest';

import { isAuthorizedServiceRequest } from './serviceAuth.js';

function requestWithAuthorization(authorization: string | null): Request {
  return {
    headers: {
      get: (name: string) => (name.toLowerCase() === 'authorization' ? authorization : null)
    }
  } as Request;
}

describe('isAuthorizedServiceRequest', () => {
  it('accepts requests with the configured bearer service token', () => {
    const request = requestWithAuthorization('Bearer service-token');

    expect(isAuthorizedServiceRequest(request, 'service-token')).toBe(true);
  });

  it('rejects requests without an authorization header', () => {
    const request = requestWithAuthorization(null);

    expect(isAuthorizedServiceRequest(request, 'service-token')).toBe(false);
  });

  it('rejects requests with the wrong bearer service token', () => {
    const request = requestWithAuthorization('Bearer wrong-token');

    expect(isAuthorizedServiceRequest(request, 'service-token')).toBe(false);
  });

  it.each([
    ['malformed scheme', 'Basic service-token'],
    ['bare token', 'service-token'],
    ['missing space', 'Bearerservice-token'],
    ['extra space after scheme', 'Bearer  service-token'],
    ['space before scheme', ' Bearer service-token'],
    ['space after token', 'Bearer service-token ']
  ])('rejects %s authorization headers', (_case, authorization) => {
    const request = requestWithAuthorization(authorization);

    expect(isAuthorizedServiceRequest(request, 'service-token')).toBe(false);
  });
});
