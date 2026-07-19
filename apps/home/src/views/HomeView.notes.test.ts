import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';

const { save } = vi.hoisted(() => ({ save: vi.fn().mockResolvedValue(undefined) }));

vi.mock('@/config/runtime', () => ({
  HOME_IS_DEV: false,
  HOME_RUNTIME: { mode: 'authenticated', clerkPublishableKey: 'test_key', convexUrl: 'https://example.test' }
}));
vi.mock('@/composables/useActiveBoard', async () => {
  const { PREVIEW_BOARD } = await import('@/data/previewBoard');
  return {
    useActiveBoard: () => ({ data: { value: PREVIEW_BOARD }, isPending: { value: false }, error: { value: null } })
  };
});
vi.mock('@/composables/useManualNotes', () => ({
  useManualNotes: () => ({ isPending: () => false, save })
}));

import HomeView from './HomeView.vue';

afterEach(() => {
  cleanup();
  save.mockClear();
});

describe('HomeView shared note workflow', () => {
  it('closes after a successful add and restores focus to Add note', async () => {
    render(HomeView);
    const addButton = screen.getByRole('button', { name: 'Add note' });

    addButton.focus();
    await addButton.click();
    await waitFor(() => expect(screen.getByLabelText('Title')).toBe(globalThis.document.activeElement));
    await fireEvent.update(screen.getByLabelText('Title'), 'Pack sports bag');
    await fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Add note' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(save).toHaveBeenCalledWith(null, { title: 'Pack sports bag' });
    expect(globalThis.document.activeElement).toBe(addButton);
  });

  it('restores focus to the exact note card after editing is cancelled', async () => {
    render(HomeView);
    const editButton = screen.getByRole('button', { name: 'Edit note: Return library books' });

    editButton.focus();
    await editButton.click();
    expect(screen.getByRole('dialog', { name: 'Edit note' })).not.toBeNull();
    await screen.getByRole('button', { name: 'Cancel' }).click();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(globalThis.document.activeElement).toBe(editButton);
  });
});
