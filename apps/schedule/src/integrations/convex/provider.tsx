'use client';

import { useAuth } from '@clerk/nextjs';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import { ConvexProviderWithClerk } from 'convex/react-clerk';
import { type ReactNode } from 'react';

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL;
const CLERK_KEY = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function MissingConvexUrl() {
  return (
    <div className="schedule-shell schedule-shell--loading" role="status">
      Schedule is missing its Convex URL.
    </div>
  );
}

// Lazily instantiate so the module can load during build even without env vars.
let _convex: ConvexReactClient | null = null;
function getConvexClient(): ConvexReactClient {
  if (!_convex) {
    _convex = new ConvexReactClient(CONVEX_URL ?? 'http://localhost:3210');
  }
  return _convex;
}

export default function AppConvexProvider({ children }: { children: ReactNode }) {
  if (CLERK_KEY && !CONVEX_URL) {
    console.error('missing envar NEXT_PUBLIC_CONVEX_URL');
    return <MissingConvexUrl />;
  }

  const convex = getConvexClient();

  if (CLERK_KEY) {
    return (
      <ConvexProviderWithClerk client={convex} useAuth={useAuth}>
        {children}
      </ConvexProviderWithClerk>
    );
  }
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
