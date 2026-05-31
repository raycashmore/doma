import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApp } from '../src/app.js';

const app = createApp();

function headersFromIncomingMessage(req: IncomingMessage) {
  const headers = new Headers();

  for (const [name, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }

    if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return headers;
}

function requestFromIncomingMessage(req: IncomingMessage) {
  const host = req.headers.host ?? 'localhost';
  const url = new URL(req.url ?? '/', `https://${host}`);
  const method = req.method ?? 'GET';
  const init: RequestInit & { duplex?: 'half' } = {
    method,
    headers: headersFromIncomingMessage(req)
  };

  if (method !== 'GET' && method !== 'HEAD') {
    init.body = req as unknown as BodyInit;
    init.duplex = 'half';
  }

  return new Request(url, init);
}

async function writeFetchResponse(res: ServerResponse, response: Response) {
  res.statusCode = response.status;

  response.headers.forEach((value, name) => {
    res.setHeader(name, value);
  });

  const body = await response.arrayBuffer();
  res.end(Buffer.from(body));
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
) {
  try {
    const response = await app.fetch(requestFromIncomingMessage(req));
    await writeFetchResponse(res, response);
  } catch {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ error: 'internal_server_error' }));
  }
}
