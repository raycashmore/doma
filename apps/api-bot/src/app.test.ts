import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';

describe('api-bot app', () => {
  it('returns health status', async () => {
    const app = createApp();

    const response = await app.request('/health');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});
