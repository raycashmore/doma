import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('shows the selected period in parentheses beside the title', () => {
    const { unmount } = render(
      <KpiCard label="Avg spend" value={123_456} delta={null} deltaPct={null} kind="money" periodLabel="6 mo" />
    );

    expect(screen.getByText('Avg spend (6 mo)')).toBeDefined();
    unmount();
  });

  it('labels changes as comparisons with the prior month', () => {
    render(<KpiCard label="Avg spend" value={123_456} delta={14_000} deltaPct={14} kind="money" periodLabel="12 mo" />);

    expect(screen.getByText('vs prior month')).toBeDefined();
    expect(screen.queryByText('vs prior 12 mo')).toBeNull();
  });
});
