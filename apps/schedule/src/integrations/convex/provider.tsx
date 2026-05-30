'use client';

import { type ReactNode } from 'react';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { useAuth } from '@clerk/nextjs';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

if (!CONVEX_URL) {
  console.error('missing envar NEXT_PUBLIC_CONVEX_URL');
}

const convex = new ConvexReactClient(CONVEX_URL ?? '');

export default function AppConvexProvider({
  children
}: {
  children: ReactNode;
}) {
  if (CLERK_KEY) {
    return (
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    );
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
