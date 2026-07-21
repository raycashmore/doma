import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ManualNoteEditor from './ManualNoteEditor.vue';

afterEach(cleanup);

describe('ManualNoteEditor', () => {
  it('submits a new note and exposes a pending state', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    render(ManualNoteEditor, { props: { note: null, save, isPending: false } });

    expect(screen.getByRole('dialog', { name: 'Add note' })).not.toBeNull();
    await fireEvent.update(screen.getByLabelText('Title'), 'Return library books');
    await fireEvent.update(screen.getByLabelText('Details (optional)'), 'Leave them by the door');
    await fireEvent.update(screen.getByLabelText('Due date (optional)'), '2026-07-20');
    await fireEvent.submit(screen.getByRole('form', { name: 'Note details' }));

    expect(save).toHaveBeenCalledWith({
      title: 'Return library books',
      detail: 'Leave them by the door',
      dueDate: '2026-07-20'
    });
  });

  it('disables dismissal and labels the save while a request is pending', () => {
    render(ManualNoteEditor, { props: { note: null, save: vi.fn(), isPending: true } });

    expect(screen.getByRole('button', { name: 'Saving…' }).hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('button', { name: 'Close note editor' }).hasAttribute('disabled')).toBe(true);
    expect((screen.getByLabelText('Title') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Details (optional)') as HTMLTextAreaElement).disabled).toBe(true);
    expect((screen.getByLabelText('Due date (optional)') as HTMLInputElement).disabled).toBe(true);
  });

  it('guards against a second submission before the pending prop updates', async () => {
    let resolveSave: (() => void) | undefined;
    const save = vi.fn(() => new Promise<void>((resolve) => (resolveSave = resolve)));
    render(ManualNoteEditor, { props: { note: null, save, isPending: false } });

    await fireEvent.update(screen.getByLabelText('Title'), 'Pack sports bag');
    const form = screen.getByRole('form', { name: 'Note details' });
    await fireEvent.submit(form);
    await fireEvent.submit(form);
    expect(save).toHaveBeenCalledTimes(1);
    expect((screen.getByLabelText('Title') as HTMLInputElement).disabled).toBe(true);
    resolveSave?.();
  });

  it('focuses the title first and traps keyboard focus inside the modal', async () => {
    render(ManualNoteEditor, { props: { note: null, save: vi.fn(), isPending: false } });

    await waitFor(() => expect(screen.getByLabelText('Title')).toBe(globalThis.document.activeElement));
    const close = screen.getByRole('button', { name: 'Close note editor' });
    close.focus();
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab', shiftKey: true });
    expect(globalThis.document.activeElement).toBe(screen.getByRole('button', { name: 'Add note' }));
  });

  it('keeps entered optional fields visible when the server rejects the title', async () => {
    const save = vi.fn().mockRejectedValue(new Error('Title is required'));
    render(ManualNoteEditor, { props: { note: null, save, isPending: false } });

    await fireEvent.update(screen.getByLabelText('Details (optional)'), 'Keep this detail');
    await fireEvent.update(screen.getByLabelText('Due date (optional)'), '2026-07-20');
    await fireEvent.submit(screen.getByRole('form', { name: 'Note details' }));

    expect(screen.getByRole('alert').textContent).toContain('Title is required');
    expect((screen.getByLabelText('Details (optional)') as HTMLTextAreaElement).value).toBe('Keep this detail');
    expect((screen.getByLabelText('Due date (optional)') as HTMLInputElement).value).toBe('2026-07-20');
  });

  it('edits an existing note and emits close on Escape', async () => {
    const save = vi.fn().mockResolvedValue(undefined);
    const { emitted } = render(ManualNoteEditor, {
      props: {
        note: {
          noteId: 'manual_note_1',
          title: 'Existing note',
          detail: 'Existing detail',
          dueDate: '2026-07-21'
        },
        save,
        isPending: false
      }
    });

    expect(screen.getByRole('dialog', { name: 'Edit note' })).not.toBeNull();
    await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(emitted()).toHaveProperty('close');
  });
});
