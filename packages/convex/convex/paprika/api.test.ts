import { gunzipSync, gzipSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { deletePaprikaGroceries, fetchPaprikaGroceries, fetchPaprikaGroceryLists, loginToPaprika } from './api';

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

describe('fetchPaprikaGroceries', () => {
  it('reads each item with its full line, recipe and purchased state, keeping the whole item', async () => {
    const raw = {
      uid: 'G1',
      list_uid: 'P1',
      name: '100g frozen spinach',
      ingredient: 'frozen spinach',
      recipe: 'Spinach pie',
      purchased: false,
      aisle: ''
    };
    const result = await fetchPaprikaGroceries('token-1', async (url, init) => {
      expect(String(url)).toBe('https://www.paprikaapp.com/api/v2/sync/groceries/');
      expect(new Headers(init?.headers).get('Authorization')).toBe('Bearer token-1');
      return jsonResponse({ result: [raw, { uid: 'G2', list_uid: 'P1', name: '  ', purchased: false }, 'junk'] });
    });

    expect(result).toEqual({
      status: 'ok',
      items: [{ uid: 'G1', listUid: 'P1', name: '100g frozen spinach', recipe: 'Spinach pie', purchased: false, raw }]
    });
  });

  it('reports a refused token and an unreachable Paprika apart', async () => {
    expect(await fetchPaprikaGroceries('t', async () => jsonResponse({ error: 'Unauthorized' }, 401))).toEqual({
      status: 'rejected',
      reason: 'Unauthorized'
    });
    expect(
      await fetchPaprikaGroceries('t', async () => {
        throw new Error('offline');
      })
    ).toEqual({ status: 'unavailable', httpStatus: null });
  });
});

describe('deletePaprikaGroceries', () => {
  it('posts the whole items back with deleted set, gzipped in the data field', async () => {
    const raw = { uid: 'G1', list_uid: 'P1', name: 'Milk', purchased: false };
    let sent: Uint8Array | undefined;
    const result = await deletePaprikaGroceries(
      'token-1',
      [{ uid: 'G1', listUid: 'P1', name: 'Milk', recipe: null, purchased: false, raw }],
      (data) => new Uint8Array(gzipSync(data)),
      async (url, init) => {
        expect(String(url)).toBe('https://www.paprikaapp.com/api/v2/sync/groceries/');
        expect(init?.method).toBe('POST');
        const file = (init?.body as FormData).get('data') as Blob;
        sent = new Uint8Array(await file.arrayBuffer());
        return jsonResponse({ result: true });
      }
    );

    expect(result).toEqual({ status: 'ok' });
    expect(JSON.parse(gunzipSync(sent!).toString())).toEqual([{ ...raw, deleted: true }]);
  });

  it('treats anything but Paprika’s own success as a failed removal', async () => {
    const gzip = (data: Uint8Array) => new Uint8Array(data);
    expect(await deletePaprikaGroceries('t', [], gzip, async () => jsonResponse({ result: false }))).toEqual({
      status: 'unavailable',
      httpStatus: 200
    });
  });
});
