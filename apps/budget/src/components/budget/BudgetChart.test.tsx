import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';

import { BUDGET_CHART_CARD_CLASS, default as BudgetChart, formatYAxisTick, getBudgetChartLayout } from './BudgetChart';

describe('BudgetChart responsive layout', () => {
  it('keeps a drawable plot area at very narrow mobile widths', () => {
    const layout = getBudgetChartLayout(72, 180);

    expect(layout.innerWidth).toBeGreaterThan(0);
    expect(layout.innerHeight).toBeGreaterThan(0);
  });

  it('uses compact y-axis labels when the chart is narrow', () => {
    expect(formatYAxisTick(1_250_000, true)).toBe('$13k');
    expect(formatYAxisTick(1_250_000, false)).toBe('$12,500');
  });

  it('keeps its mobile minimum height until the desktop dashboard layout', () => {
    expect(BUDGET_CHART_CARD_CLASS).toContain('min-h-[16rem]');
    expect(BUDGET_CHART_CARD_CLASS).toContain('lg:min-h-0');
    expect(BUDGET_CHART_CARD_CLASS).not.toContain('md:min-h-0');
  });

  it('shows legend labels in Income, Spend, Mortgage order', () => {
    const { container } = render(<BudgetChart data={[]} period="6M" />);

    expect(screen.getByText('Income')).toBeDefined();
    expect(screen.getByText('Spend')).toBeDefined();
    expect(screen.getByText('Mortgage')).toBeDefined();
    expect(screen.queryByText('Discretionary')).toBeNull();

    const legendText = container.querySelector('h2')?.nextElementSibling?.textContent;
    expect(legendText).toBe('IncomeSpendMortgage');
  });
});
