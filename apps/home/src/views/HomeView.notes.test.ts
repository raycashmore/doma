import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/vue';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

const { save, archive } = vi.hoisted(() => ({
  save: vi.fn().mockResolvedValue(undefined),
  archive: vi.fn().mockResolvedValue(undefined)
}));

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
vi.mock('@/composables/useBoardArchive', () => ({
  useBoardArchive: () => ({ isPending: { value: false }, archive })
}));
vi.mock('@/composables/useConvexConnectionStatus', () => ({
  useConvexConnectionStatus: () => ({ value: 'connected' })
}));

import HomeView from './HomeView.vue';

function renderHomeView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', component: { template: '<main />' } },
      { path: '/notices/:noticeId', component: { template: '<main />' } }
    ]
  });
  return render(HomeView, { global: { plugins: [router] } });
}

afterEach(() => {
  cleanup();
  save.mockClear();
  archive.mockClear();
});

describe('HomeView shared note workflow', () => {
  it('closes after a successful add and restores focus to Add note', async () => {
    renderHomeView();
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
    renderHomeView();
    const editButton = screen.getByRole('button', { name: 'Edit note: Return library books' });

    editButton.focus();
    await editButton.click();
    expect(screen.getByRole('dialog', { name: 'Edit note' })).not.toBeNull();
    await screen.getByRole('button', { name: 'Cancel' }).click();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(globalThis.document.activeElement).toBe(editButton);
  });

  it('requires confirmation and restores focus to the overflow trigger on cancel', async () => {
    renderHomeView();
    const overflow = screen.getByRole('button', { name: 'More actions for Today' });

    overflow.focus();
    await overflow.click();
    await screen.getByRole('menuitem', { name: 'Archive' }).click();
    expect(screen.getByRole('dialog', { name: 'Archive Today?' })).not.toBeNull();
    await screen.getByRole('button', { name: 'Cancel' }).click();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(globalThis.document.activeElement).toBe(overflow);
    expect(archive).not.toHaveBeenCalled();
  });

  it('archives the selected occurrence and moves focus to a stable action after success', async () => {
    renderHomeView();
    const addButton = screen.getByRole('button', { name: 'Add note' });
    await screen.getByRole('button', { name: 'More actions for Return library books' }).click();
    await screen.getByRole('menuitem', { name: 'Archive' }).click();
    await screen.getByRole('button', { name: 'Archive item' }).click();

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(archive).toHaveBeenCalledWith(expect.objectContaining({ id: 'manualNote:preview-library-books' }));
    expect(globalThis.document.activeElement).toBe(addButton);
  });
});
