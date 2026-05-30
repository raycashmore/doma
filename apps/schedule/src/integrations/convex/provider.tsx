'use client';

import { type ReactNode, useMemo } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/nextjs';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (typeof window !== 'undefined' && !CONVEX_URL) {
  console.error('missing envar NEXT_PUBLIC_CONVEX_URL');
}

// Lazily instantiate so the module can load during build even without env vars.
let _convex: ConvexReactClient | null = null;
function getConvexClient(): ConvexReactClient {
  if (!_convex) {
    _convex = new ConvexReactClient(CONVEX_URL ?? 'http://localhost:3210');
  }
  return _convex;
}

export default function AppConvexProvider({
  children
}: {
  children: ReactNode;
}) {
  const convex = useMemo(() => getConvexClient(), []);

  if (CLERK_KEY) {
    return (
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    );
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
