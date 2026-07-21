import { cleanup, render, screen } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';

import HomeView from './HomeView.vue';

afterEach(cleanup);

describe('HomeView', () => {
  it('shows the generic Today and Meals board in local demo mode', () => {
    render(HomeView);

    expect(screen.getByRole('heading', { name: 'Noticeboard' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Today' })).not.toBeNull();
    expect(screen.getByText('Mon, 13 Jul')).not.toBeNull();
    expect(screen.getByText('School lunch · Pasta salad')).not.toBeNull();
    expect(screen.getByText('Dinner · Not planned')).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'Permission form due' })).not.toBeNull();
    expect(screen.getByRole('heading', { name: 'June spending settled' })).not.toBeNull();
  });
});
