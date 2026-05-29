import { serve } from '@hono/node-server';
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3002);

serve({ fetch: createApp().fetch, port }, (info) => {
  console.log(`[api-bot] listening on http://localhost:${info.port}`);
});
