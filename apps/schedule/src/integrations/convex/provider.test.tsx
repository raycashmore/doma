import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const convexClientSpy = vi.fn();

vi.mock('convex/react', () => ({
  ConvexReactClient: convexClientSpy,
  ConvexProvider: ({ children }: { children: ReactNode }) => <div data-testid="convex-provider">{children}</div>
}));

vi.mock('convex/react-clerk', () => ({
  ConvexProviderWithClerk: ({ children }: { children: ReactNode }) => (
    <div data-testid="convex-clerk-provider">{children}</div>
  )
}));

vi.mock('@clerk/nextjs', () => ({
  useAuth: () => ({ isLoaded: true, isSignedIn: true })
}));

async function importProvider() {
  vi.resetModules();
  return import('./provider');
}

describe('AppConvexProvider', () => {
  beforeEach(() => {
    convexClientSpy.mockClear();
    delete process.env.NEXT_PUBLIC_CONVEX_URL;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  });

  afterEach(cleanup);

  it('renders an explicit configuration error instead of falling back to localhost when auth is enabled', async () => {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_example';

    const { default: AppConvexProvider } = await importProvider();

    render(
      <AppConvexProvider>
        <div>Schedule content</div>
      </AppConvexProvider>
    );

    expect(screen.getByText('Schedule is missing its Convex URL.')).toBeDefined();
    expect(screen.queryByText('Schedule content')).toBeNull();
    expect(convexClientSpy).not.toHaveBeenCalled();
  });
});
