import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('shows the selected period as supporting text below the title', () => {
    const { unmount } = render(
      <KpiCard
        label="Avg spend"
        value={123_456}
        delta={null}
        deltaPct={null}
        kind="money"
        periodLabel="Trailing 6 months"
        comparisonLabel="vs May"
      />
    );

    expect(screen.getByText('Avg spend')).toBeDefined();
    expect(screen.getByText('Trailing 6 months')).toBeDefined();
    expect(screen.queryByText('Avg spend (6 mo)')).toBeNull();
    unmount();
  });

  it('labels changes as comparisons with the prior comparison month', () => {
    render(
      <KpiCard
        label="Avg spend"
        value={123_456}
        delta={14_000}
        deltaPct={14}
        kind="money"
        periodLabel="Trailing 12 months"
        comparisonLabel="vs May"
      />
    );

    expect(screen.getByText('vs May')).toBeDefined();
    expect(screen.queryByText('vs prior 12 mo')).toBeNull();
  });
});
