import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useRefreshToken } from './refreshToken';

describe('useRefreshToken', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-13T07:00:00.000Z'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('changes each minute', () => {
    const { result } = renderHook(() => useRefreshToken());
    const first = result.current;

    act(() => vi.advanceTimersByTime(60_000));

    expect(result.current).toBe(first + 1);
  });

  it('catches up when the page becomes visible after the timer was paused', () => {
    const { result } = renderHook(() => useRefreshToken());
    const first = result.current;

    act(() => {
      vi.setSystemTime(new Date('2026-07-13T09:00:00.000Z'));
      document.dispatchEvent(new Event('visibilitychange'));
    });

    expect(result.current).toBe(first + 120);
  });
});
