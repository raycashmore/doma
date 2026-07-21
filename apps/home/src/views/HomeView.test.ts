import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';
import { createMemoryHistory, createRouter } from 'vue-router';

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

afterEach(cleanup);

describe('HomeView', () => {
  it('shows the generic Today and Meals board in local demo mode', () => {
    renderHomeView();

    expect(screen.getByRole('heading', { name: 'Noticeboard' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Today' })).not.toBeNull();
    expect(screen.getByText('Mon, 13 Jul')).not.toBeNull();
    expect(screen.getByText('School lunch · Pasta salad')).not.toBeNull();
    expect(screen.getByText('Dinner · Not planned')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Permission form due' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'June spending settled' })).not.toBeNull();
  });
});
