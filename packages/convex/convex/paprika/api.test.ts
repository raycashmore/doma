import { describe, expect, it } from 'vitest';

import { fetchPaprikaGroceryLists, loginToPaprika } from './api';

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

const credentials = { email: 'person@example.com', password: 'secret-password' };

describe('loginToPaprika', () => {
  it('sends the email and password as a form and returns the token', async () => {
    let request: { url: string; init?: RequestInit } | undefined;
    const result = await loginToPaprika(credentials, async (url, init) => {
      request = { url: String(url), init };
      return jsonResponse({ result: { token: 'token-1' } });
    });

    expect(result).toEqual({ status: 'ok', token: 'token-1' });
    expect(request?.url).toBe('https://www.paprikaapp.com/api/v1/account/login/');
    expect(request?.init?.method).toBe('POST');
    expect(new URLSearchParams(String(request?.init?.body)).get('email')).toBe('person@example.com');
  });

  it('treats a 401 carrying Paprika’s error as a refused sign-in', async () => {
    const result = await loginToPaprika(credentials, async () => jsonResponse({ error: 'Unauthorized' }, 401));
    expect(result).toEqual({ status: 'rejected', reason: 'Unauthorized' });
  });

  it('does not read a block page in front of Paprika as a wrong password', async () => {
    const blocked = await loginToPaprika(
      credentials,
      async () => new Response('<html>Access denied</html>', { status: 403 })
    );
    expect(blocked).toEqual({ status: 'unavailable', httpStatus: 403 });
  });

  it('treats an error body without a result as a refused sign-in, even with a 200', async () => {
    const result = await loginToPaprika(credentials, async () =>
      jsonResponse({ error: { code: 0, message: 'Invalid email or password' } })
    );
    expect(result).toEqual({ status: 'rejected', reason: 'Invalid email or password' });
  });

  it('reports Paprika unavailable when the request fails, the server errors or the reply is malformed', async () => {
    const offline = await loginToPaprika(credentials, async () => {
      throw new TypeError('fetch failed');
    });
    const serverError = await loginToPaprika(credentials, async () => new Response('oops', { status: 502 }));
    const noToken = await loginToPaprika(credentials, async () => jsonResponse({ result: {} }));

    expect([offline, serverError, noToken]).toEqual([
      { status: 'unavailable', httpStatus: null },
      { status: 'unavailable', httpStatus: 502 },
      { status: 'unavailable', httpStatus: 200 }
    ]);
  });

  it('never puts the password in a result', async () => {
    const results = await Promise.all([
      loginToPaprika(credentials, async () => jsonResponse({ result: { token: 'token-1' } })),
      loginToPaprika(credentials, async () => jsonResponse({ error: 'bad' }, 401)),
      loginToPaprika(credentials, async () => {
        throw new Error(`failed with ${credentials.password}`);
      })
    ]);
    expect(JSON.stringify(results)).not.toContain(credentials.password);
  });
});

describe('fetchPaprikaGroceryLists', () => {
  it('sends the token as a bearer and returns the lists', async () => {
    let authorization: string | null = null;
    const result = await fetchPaprikaGroceryLists('token-1', async (_url, init) => {
      authorization = new Headers(init?.headers).get('Authorization');
      return jsonResponse({
        result: [
          { uid: 'L1', name: 'My Grocery List', order_flag: 0, is_default: true, reminders_list: 'x' },
          { uid: 'L2', name: 'Party', order_flag: 1, is_default: false }
        ]
      });
    });

    expect(authorization).toBe('Bearer token-1');
    expect(result).toEqual({
      status: 'ok',
      lists: [
        { uid: 'L1', name: 'My Grocery List', isDefault: true },
        { uid: 'L2', name: 'Party', isDefault: false }
      ]
    });
  });

  it('treats a token Paprika refuses as rejected', async () => {
    const result = await fetchPaprikaGroceryLists('stale', async () =>
      jsonResponse({ error: { code: 0, message: 'Invalid or expired credentials.' } }, 401)
    );
    expect(result).toEqual({ status: 'rejected', reason: 'Invalid or expired credentials.' });
  });

  it('reports Paprika unavailable for a malformed reply', async () => {
    const result = await fetchPaprikaGroceryLists('token-1', async () => jsonResponse({ result: 'nope' }));
    expect(result).toEqual({ status: 'unavailable', httpStatus: 200 });
  });
});
