import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import BudgetBreakdownTable from './BudgetBreakdownTable';

function row(month: number) {
  return {
    date: new Date(2026, month, 1).getTime(),
    income: 800_000,
    spend: 250_000,
    mortgage: 300_000,
    net: 250_000
  };
}

describe('BudgetBreakdownTable', () => {
  it('renders all rows and relies on scrolling when the list is long', () => {
    const { container } = render(
      <BudgetBreakdownTable
        rows={[row(4), row(3), row(2), row(1), row(0), row(11), row(10)]}
        onRowClick={() => {}}
      />
    );

    expect(screen.getByText('May 2026')).toBeDefined();
    expect(screen.getByText('Jan 2026')).toBeDefined();
    expect(screen.getByText('Dec 2026')).toBeDefined();
    expect(screen.getByText('Nov 2026')).toBeDefined();

    const scroller = container.querySelector('table')?.parentElement;
    expect(scroller?.className).toContain('overflow-auto');
  });

  it('keeps row click behavior for visible rows', () => {
    const onRowClick = vi.fn();
    const mayDate = row(4).date;

    const { container } = render(
      <BudgetBreakdownTable
        rows={[row(4), row(3), row(2)]}
        onRowClick={onRowClick}
      />
    );

    fireEvent.click(within(container).getByText('May 2026'));
    expect(onRowClick).toHaveBeenCalledWith(mayDate);
  });
});
