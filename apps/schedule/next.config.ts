import type { NextConfig } from 'next';
import { getScheduleBasePath } from './src/config/basePath';

const isDev = process.env.NODE_ENV !== 'production';
const basePath = getScheduleBasePath(isDev);

const nextConfig: NextConfig = {
  // /schedule base only in production. In dev, serve at the root of port 3003
  // so cross-port links from other zones (which target localhost:3003/) work.
  basePath: basePath || undefined,
  // Workspace packages ship TS/TSX and must be transpiled by Next.
  transpilePackages: ['@repo/shell', '@repo/tokens']
};

export default nextConfig;
