import { act } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';

import { useDesktopViewport } from './useDesktopViewport';

function ViewportLabel() {
  return <span>{useDesktopViewport() ? 'Desktop' : 'Mobile'}</span>;
}

function mockViewport(initialMatches: boolean) {
  let matches = initialMatches;
  const listeners = new Set<() => void>();
  vi.stubGlobal('matchMedia', () => ({
    get matches() {
      return matches;
    },
    addEventListener: (_event: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_event: string, listener: () => void) => listeners.delete(listener)
  }));
  return (nextMatches: boolean) => {
    matches = nextMatches;
    listeners.forEach((listener) => listener());
  };
}

afterEach(() => vi.unstubAllGlobals());

it('hydrates server markup on a desktop viewport without a mismatch', async () => {
  mockViewport(true);
  const container = document.createElement('div');
  container.innerHTML = renderToString(<ViewportLabel />);
  expect(container.textContent).toBe('Mobile');
  const onRecoverableError = vi.fn();
  const root = hydrateRoot(container, <ViewportLabel />, { onRecoverableError });
  try {
    await act(async () => {});
    expect(container.textContent).toBe('Desktop');
    expect(onRecoverableError).not.toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
  }
});

it('updates the viewport when the media query changes', () => {
  const resize = mockViewport(false);
  const { result } = renderHook(() => useDesktopViewport());
  expect(result.current).toBe(false);
  act(() => resize(true));
  expect(result.current).toBe(true);
  act(() => resize(false));
  expect(result.current).toBe(false);
});
