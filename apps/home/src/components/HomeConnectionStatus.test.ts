import { cleanup, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import HomeConnectionStatus from './HomeConnectionStatus.vue';

const connectionStatus = ref<'connecting' | 'connected' | 'reconnecting'>('connected');

vi.mock('@/composables/useConvexConnectionStatus', () => ({
  useConvexConnectionStatus: () => connectionStatus
}));

afterEach(() => {
  cleanup();
  connectionStatus.value = 'connected';
  vi.unstubAllGlobals();
});

describe('HomeConnectionStatus', () => {
  it('shows an explicit offline state and recovers when the browser reconnects', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    render(HomeConnectionStatus, { props: { isPending: false, hasError: false } });

    expect(screen.getByRole('status').textContent).toContain('Offline');

    Object.defineProperty(globalThis.navigator, 'onLine', { configurable: true, value: true });
    globalThis.window.dispatchEvent(new Event('online'));

    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Live household data connected'));
  });

  it('announces loading and leaves query errors to the board alert', async () => {
    const { rerender } = render(HomeConnectionStatus, { props: { isPending: true, hasError: false } });
    expect(screen.getByRole('status').textContent).toContain('Connecting');

    await rerender({ isPending: false, hasError: true });

    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('reports a dropped Convex connection while cached board data remains', async () => {
    const { rerender } = render(HomeConnectionStatus, { props: { isPending: false, hasError: false } });
    expect(screen.getByRole('status').textContent).toContain('connected');

    connectionStatus.value = 'reconnecting';
    await rerender({});
    expect(screen.getByRole('status').textContent).toContain('Reconnecting');

    connectionStatus.value = 'connected';
    await rerender({});
    expect(screen.getByRole('status').textContent).toContain('connected');
  });
});
