import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MonthSpendSection from './MonthSpendSection';

describe('MonthSpendSection', () => {
  it('shows credit card totals and category rows without the old category title', () => {
    render(
      <MonthSpendSection
        credit1={10_000}
        credit2={20_000}
        credit3={30_000}
        categories={[
          { category: 'Category A', amount: 12_345 },
          { category: 'Category B', amount: 6_789 }
        ]}
        oneOffs={4_000}
      />
    );

    expect(screen.queryByText('Card spend by category')).toBeNull();
    expect(screen.getByText('Credit card primary')).toBeDefined();
    expect(screen.getByText('Credit card secondary')).toBeDefined();
    expect(screen.getByText('$400')).toBeDefined();
    expect(screen.getByText('$200')).toBeDefined();
    expect(screen.getByText('Category A')).toBeDefined();
    expect(screen.getByText('$123')).toBeDefined();
    expect(screen.getByText('Category B')).toBeDefined();
    expect(screen.getByText('$68')).toBeDefined();
  });

  it('shows an explicit empty state when no category rows exist', () => {
    render(
      <MonthSpendSection
        credit1={10_000}
        credit2={20_000}
        credit3={30_000}
        categories={[]}
        oneOffs={4_000}
      />
    );

    expect(screen.getByText('No category data for this month.')).toBeDefined();
  });

  it('collapses long category lists and expands them on request', () => {
    const categories = [
      {
        category:
          'Extremely long household maintenance category name that should not overflow',
        amount: 12_345
      },
      { category: 'Category B', amount: 6_789 },
      { category: 'Category C', amount: 5_000 },
      { category: 'Category D', amount: 4_000 },
      { category: 'Category E', amount: 3_000 },
      { category: 'Category F', amount: 2_000 },
      { category: 'Category G', amount: 1_000 },
      { category: 'Category H', amount: 900 },
      { category: 'Category I', amount: 800 },
      { category: 'Category J', amount: 700 },
      { category: 'Category K', amount: 600 }
    ];

    render(
      <MonthSpendSection
        credit1={10_000}
        credit2={20_000}
        credit3={30_000}
        categories={categories}
        oneOffs={4_000}
      />
    );

    const longLabel = screen.getByText(
      'Extremely long household maintenance category name that should not overflow'
    );
    expect(longLabel.className).toContain('break-words');
    expect(screen.getByText('Category J')).toBeDefined();
    expect(screen.queryByText('Category K')).toBeNull();

    const expandButton = screen.getByRole('button', {
      name: 'Show all spending categories'
    });
    expect(expandButton.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('Show 1 more')).toBeDefined();

    fireEvent.click(expandButton);

    expect(screen.getByText('Category K')).toBeDefined();
    const collapseButton = screen.getByRole('button', {
      name: 'Show fewer spending categories'
    });
    expect(collapseButton.getAttribute('aria-expanded')).toBe('true');
  });
});
