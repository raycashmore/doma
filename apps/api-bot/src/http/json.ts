import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export function jsonOk<T>(c: Context, body: T, status: ContentfulStatusCode = 200) {
  return c.json(body, status);
}

export function jsonError(c: Context, status: ContentfulStatusCode, code: string) {
  return c.json({ error: code }, status);
}
