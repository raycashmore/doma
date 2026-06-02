import type { NextConfig } from 'next';
import { getScheduleBasePath } from './src/config/basePath';

const isDev = process.env.NODE_ENV !== 'production';
const basePath = getScheduleBasePath(isDev);

const nextConfig: NextConfig = {
  // /schedule base only in production. In dev, serve at the root of port 3003
  // so cross-port links from other zones (which target localhost:3003/) work.
  basePath: basePath || undefined,
  // Workspace packages ship TS/TSX and must be transpiled by Next.
  transpilePackages: ['@repo/shell', '@repo/tokens'],
  // In production the app is served under /schedule, so hitting the deployment
  // root (e.g. the Vercel preview URL) would otherwise 404. Redirect / → the
  // base path for parity with the budget zone. `basePath: false` makes the
  // source match the true root rather than being prefixed with /schedule.
  ...(basePath
    ? {
        async redirects() {
          return [
            {
              source: '/',
              destination: basePath,
              basePath: false,
              permanent: false
            }
          ];
        }
      }
    : {})
};

export default nextConfig;
