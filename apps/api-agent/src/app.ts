import type { IncomingMessage, ServerResponse } from 'node:http';

import { Hono } from 'hono';

import { runWeeklyMealsAgent } from './agents/weekly-meals/run.js';
import { weeklyMealsRunInputSchema } from './agents/weekly-meals/schemas.js';
import { authenticateClerkRequest } from './auth/clerk.js';
import type { AgentConfig } from './config.js';
import { getConfig } from './config.js';
import { createWeeklyMealsConvex } from './convex/weeklyMeals.js';

export function createApp(config: AgentConfig = getConfig()) {
  const app = new Hono();
  app.onError((_error, c) => c.json({ error: 'internal_server_error' }, 500));
  app.get('/health', (c) => c.json({ ok: true }));
  app.post('/weekly-meals', async (c) => {
    const auth = await authenticateClerkRequest(c.req.raw, config);
    if (!auth) return c.json({ error: 'unauthorized' }, 401);

    const body = weeklyMealsRunInputSchema.omit({ userId: true }).safeParse(await c.req.json().catch(() => null));
    if (!body.success) return c.json({ error: 'invalid_request' }, 400);
    const convex = createWeeklyMealsConvex(config, body.data.weekStart, auth.userId);
    const result = await runWeeklyMealsAgent({
      model: config.weeklyMealsModel,
      input: { userId: auth.userId, ...body.data },
      tools: convex.tools,
      saveTrace: convex.saveTrace
    });
    return c.json(result);
  });
  return app;
}

let runtimeApp: ReturnType<typeof createApp> | undefined;

function toRequest(req: IncomingMessage) {
  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(name, item));
    else if (value !== undefined) headers.set(name, value);
  }
  const method = req.method ?? 'GET';
  return new Request(new URL(req.url ?? '/', `https://${req.headers.host ?? 'localhost'}`), {
    method,
    headers,
    ...(method === 'GET' || method === 'HEAD' ? {} : { body: req as unknown as BodyInit, duplex: 'half' })
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  runtimeApp ??= createApp();
  try {
    const response = await runtimeApp.fetch(toRequest(req));
    res.statusCode = response.status;
    response.headers.forEach((value, name) => res.setHeader(name, value));
    res.end(Buffer.from(await response.arrayBuffer()));
  } catch {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'internal_server_error' }));
  }
}
