import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { KpiCard } from './KpiCard';

describe('KpiCard', () => {
  it('shows the selected period in parentheses beside the title', () => {
    render(<KpiCard label="Avg spend" value={123_456} delta={null} deltaPct={null} kind="money" periodLabel="6 mo" />);

    expect(screen.getByText('Avg spend (6 mo)')).toBeDefined();
  });
});
