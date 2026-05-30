import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MobileNav } from './MobileNav';

describe('MobileNav', () => {
  it('renders a link per enabled app plus home, marking the active one', () => {
    render(<MobileNav activeAppId="budget" isDev={false} />);

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
});
