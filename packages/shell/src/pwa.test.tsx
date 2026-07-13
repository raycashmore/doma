import { registerServiceWorker } from '@repo/pwa';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { PwaUpdater } from './pwa';

vi.mock('@repo/pwa', () => ({
  registerServiceWorker: vi.fn()
}));

describe('PwaUpdater', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('reloads automatically while keeping the update toast as a fallback', async () => {
    const reload = vi.fn();
    vi.mocked(registerServiceWorker).mockReturnValue({ reload, dispose: vi.fn() });

    render(<PwaUpdater swUrl="/sw.js" scope="/" autoReload />);

    const options = vi.mocked(registerServiceWorker).mock.calls[0]?.[0];
    act(() => options?.onNeedRefresh?.());

    expect(screen.getByRole('status').textContent).toContain('A new version is available.');
    await waitFor(() => expect(reload).toHaveBeenCalledOnce());
  });
});
