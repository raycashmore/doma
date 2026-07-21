import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ArchiveConfirmation from './ArchiveConfirmation.vue';

afterEach(cleanup);

const item = { id: 'manualNote:note_1', title: 'Return library books' };

describe('ArchiveConfirmation', () => {
  it('requires an explicit confirmation and emits archived after success', async () => {
    const archive = vi.fn().mockResolvedValue(undefined);
    const { emitted } = render(ArchiveConfirmation, { props: { item, archive, isPending: false } });

    expect(screen.getByRole('dialog', { name: 'Archive Return library books?' })).not.toBeNull();
    expect(screen.getByText(/removed from the shared noticeboard for everyone/i)).not.toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Cancel' })).toBe(globalThis.document.activeElement));
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(globalThis.document.activeElement).toBe(screen.getByRole('button', { name: 'Archive item' }));
    await screen.getByRole('button', { name: 'Archive item' }).click();

    expect(archive).toHaveBeenCalledOnce();
    expect(emitted()).toHaveProperty('archived');
  });

  it('keeps confirmation open with a recoverable error and guards duplicate requests', async () => {
    let rejectArchive: ((error: Error) => void) | undefined;
    const archive = vi.fn(() => new Promise<void>((_resolve, reject) => (rejectArchive = reject)));
    render(ArchiveConfirmation, { props: { item, archive, isPending: false } });

    const confirm = screen.getByRole('button', { name: 'Archive item' });
    await confirm.click();
    await fireEvent.click(confirm);
    expect(archive).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Archiving…' }).hasAttribute('disabled')).toBe(true);

    rejectArchive?.(new Error('Archive failed. Try again.'));
    await waitFor(() => expect(screen.getByRole('alert').textContent).toContain('Archive failed'));
    expect(screen.getByRole('button', { name: 'Archive item' }).hasAttribute('disabled')).toBe(false);
  });

  it('emits cancel on Escape when idle', async () => {
    const { emitted } = render(ArchiveConfirmation, {
      props: { item, archive: vi.fn(), isPending: false }
    });

    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(emitted()).toHaveProperty('cancel');
  });
});
