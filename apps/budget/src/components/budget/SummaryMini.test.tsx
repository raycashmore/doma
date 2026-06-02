import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import SummaryMini from './SummaryMini';

describe('SummaryMini', () => {
  it('renders label and value', () => {
    render(<SummaryMini label="Income" value={123_456} fill="bg-x" />);
    expect(screen.getByText('Income')).toBeDefined();
    // formatCurrency divides cents by 100 and formats in en-AU
    expect(screen.getByText(/\$/)).toBeDefined();
  });

  it('omits trend row when trend is null', () => {
    const { container } = render(<SummaryMini label="Income" value={1000} fill="bg-x" trend={null} />);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.queryByText(/MoM/)).toBeNull();
  });

  it('omits trend row when trend is undefined', () => {
    const { container } = render(<SummaryMini label="Income" value={1000} fill="bg-x" />);
    expect(container.querySelector('svg')).toBeNull();
  });

  it('renders up trend with positive color and "+" sign', () => {
    render(<SummaryMini label="Income" value={1000} fill="bg-x" trend={{ pct: 2.4, direction: 'up' }} />);
    const row = screen.getByText(/\+2\.4% MoM/).parentElement!;
    expect(row.className).toContain('text-warm-positive');
    expect(row.querySelector('svg')).toBeTruthy();
  });

  it('renders down trend with accent color and no "+" sign', () => {
    render(<SummaryMini label="Spend" value={1000} fill="bg-x" trend={{ pct: -5.7, direction: 'down' }} />);
    const row = screen.getByText(/-5\.7% MoM/).parentElement!;
    expect(row.className).toContain('text-warm-accent');
    expect(row.querySelector('svg')).toBeTruthy();
  });

  it('renders flat trend with secondary text color', () => {
    render(<SummaryMini label="Mortgage" value={1000} fill="bg-x" trend={{ pct: 0, direction: 'flat' }} />);
    const row = screen.getByText(/Flat MoM/).parentElement!;
    expect(row.className).toContain('text-warm-text-secondary');
  });
});
