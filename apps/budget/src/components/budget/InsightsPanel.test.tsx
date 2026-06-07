import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InsightsPanel } from './InsightsPanel';

describe('InsightsPanel', () => {
  it('hides the temporary encouragement card while keeping the coming soon state', () => {
    render(<InsightsPanel />);

    expect(screen.queryByText("You're in good shape")).toBeNull();
    expect(screen.getByText('Personalised insights coming soon')).toBeDefined();
  });

  it('stays collapsed until the large dashboard breakpoint', () => {
    const { container } = render(<InsightsPanel />);
    const panel = container.querySelector('aside');

    expect(panel?.className).toContain('hidden');
    expect(panel?.className).toContain('lg:flex');
  });
});
