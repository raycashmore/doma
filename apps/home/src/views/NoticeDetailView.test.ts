import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

import NoticeDetailView from './NoticeDetailView.vue';

afterEach(cleanup);

describe('NoticeDetailView', () => {
  it('opens the canonical forwarded-email notice detail without making it editable', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<main />' } },
        { path: '/notices/:noticeId', component: NoticeDetailView }
      ]
    });
    await router.push('/notices/preview-permission-form');
    await router.isReady();

    render(NoticeDetailView, { global: { plugins: [router] } });

    expect(screen.getByRole('heading', { name: 'Permission form due' })).not.toBeNull();
    expect(screen.getByText('Return the form before Friday.')).not.toBeNull();
    expect(screen.getByText('due')).not.toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to noticeboard' }).getAttribute('href')).toBe('/');
  });
});
