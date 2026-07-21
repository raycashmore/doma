import { describe, expect, it } from 'vitest';

import { isHomeNavigationPath } from './pwa';

describe('Home PWA navigation boundary', () => {
  it.each(['/api/bot/linking/status', '/api/agent/runs', '/budget', '/schedule/week', '/lists/', '/meals/week'])(
    'does not handle %s as a Home navigation',
    (path) => {
      expect(isHomeNavigationPath(path)).toBe(false);
    }
  );

  it.each(['/', '/settings/notifications', '/unknown-home-route'])('keeps %s inside the Home SPA', (path) => {
    expect(isHomeNavigationPath(path)).toBe(true);
  });
});
