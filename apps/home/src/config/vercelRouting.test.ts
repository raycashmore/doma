import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

type Route = { source: string; destination: string };

const config = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  redirects: Route[];
  rewrites: Route[];
};

describe('Home production routing', () => {
  it.each([
    ['/api/bot/:path*', 'https://bot.rayandromana.com/:path*'],
    ['/api/agent/:path*', 'https://agent.rayandromana.com/:path*'],
    ['/budget/:path*', 'https://budget.rayandromana.com/budget/:path*'],
    ['/schedule/:path*', 'https://schedule.rayandromana.com/schedule/:path*'],
    ['/lists/:path*', 'https://lists.rayandromana.com/lists/:path*'],
    ['/meals/:path*', 'https://meals.rayandromana.com/meals/:path*']
  ])('routes %s before the Home fallback', (source, destination) => {
    const route = config.rewrites.find((candidate) => candidate.source === source);
    const fallbackIndex = config.rewrites.findIndex((candidate) => candidate.source === '/(.*)');

    expect(route?.destination).toBe(destination);
    expect(config.rewrites.indexOf(route as Route)).toBeLessThan(fallbackIndex);
  });

  it('serves direct Home and settings loads through the SPA fallback', () => {
    expect(config.rewrites.at(-1)).toEqual({ source: '/(.*)', destination: '/index.html' });
  });
});
