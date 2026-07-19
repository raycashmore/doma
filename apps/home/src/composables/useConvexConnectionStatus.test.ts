import { describe, expect, it, vi } from 'vitest';
import { effectScope } from 'vue';

import { useConvexConnectionStatus } from './useConvexConnectionStatus';

type State = {
  isWebSocketConnected: boolean;
  hasEverConnected: boolean;
  connectionRetries: number;
};

describe('useConvexConnectionStatus', () => {
  it('tracks initial connection, reconnecting, and recovered states', () => {
    let callback: ((state: State) => void) | undefined;
    const unsubscribe = vi.fn();
    const client = {
      connectionState: () => ({ isWebSocketConnected: false, hasEverConnected: false, connectionRetries: 0 }),
      subscribeToConnectionState: vi.fn((next: (state: State) => void) => {
        callback = next;
        return unsubscribe;
      })
    };
    const scope = effectScope();
    const status = scope.run(() => useConvexConnectionStatus(client))!;

    expect(status.value).toBe('connecting');
    callback?.({ isWebSocketConnected: true, hasEverConnected: true, connectionRetries: 0 });
    expect(status.value).toBe('connected');
    callback?.({ isWebSocketConnected: false, hasEverConnected: true, connectionRetries: 1 });
    expect(status.value).toBe('reconnecting');
    callback?.({ isWebSocketConnected: true, hasEverConnected: true, connectionRetries: 1 });
    expect(status.value).toBe('connected');

    scope.stop();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});
