'use client';

import { useEffect, useState } from 'react';

const MINUTE_MS = 60_000;

const currentMinute = () => Math.floor(Date.now() / MINUTE_MS);

/**
 * The current minute, updated every minute and when the page becomes visible again. Pass it as a
 * Convex query's `refreshToken` when the query reads the clock, so Convex re-runs it rather than
 * serving a result cached for an earlier time.
 */
export function useRefreshToken() {
  const [token, setToken] = useState(currentMinute);

  useEffect(() => {
    const tick = () => setToken(currentMinute());
    const interval = setInterval(tick, MINUTE_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  return token;
}
