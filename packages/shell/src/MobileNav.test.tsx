import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { UrlAuthProvider } from './auth';
import { MobileNav } from './MobileNav';

describe('MobileNav', () => {
  afterEach(cleanup);

  it('renders a link per enabled app plus home, marking the active one', () => {
    render(<MobileNav activeAppId="budget" isDev={false} />);

    expect(screen.getByRole('navigation', { name: 'App navigation' }).classList.contains('mobile-app-nav')).toBe(true);

    const home = screen.getByRole('link', { name: 'Home' });
    expect(home.getAttribute('href')).toBe('/');

    const budget = screen.getByRole('link', { name: 'Budget' });
    expect(budget.getAttribute('href')).toBe('/budget');
    expect(budget.getAttribute('aria-current')).toBe('page');
  });

  it('omits disabled apps', () => {
    render(<MobileNav activeAppId="budget" isDev={false} />);
    expect(screen.queryByRole('link', { name: 'Recipes' })).toBeNull();
  });

  it('decorates cross-origin hrefs with the auth token in dev', () => {
    render(
      <UrlAuthProvider buildUrlWithAuth={(url) => `${url}?token=dev`}>
        <MobileNav activeAppId="budget" isDev={true} />
      </UrlAuthProvider>
    );
    const budget = screen.getByRole('link', { name: 'Budget' });
    expect(budget.getAttribute('href')).toBe('http://localhost:3001/?token=dev');
  });
});
