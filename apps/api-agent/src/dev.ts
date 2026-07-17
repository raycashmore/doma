import { serve } from '@hono/node-server';

import { createApp } from './app.js';

// eslint-disable-next-line turbo/no-undeclared-env-vars
const port = Number(process.env.PORT ?? 3006);
serve({ fetch: createApp().fetch, port }, (info) =>
  console.log(`[api-agent] listening on http://localhost:${info.port}`)
);
