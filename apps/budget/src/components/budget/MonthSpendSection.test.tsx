import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import MonthSpendSection from './MonthSpendSection';

describe('MonthSpendSection', () => {
  it('shows card spend category rows when provided', () => {
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

    expect(screen.getByText('Card spend by category')).toBeDefined();
    expect(screen.getByText('$600')).toBeDefined();
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

    expect(
      screen.getByText('No category data for this month.')
    ).toBeDefined();
  });
});
