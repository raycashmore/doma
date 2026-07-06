import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { InsightsPanel } from './InsightsPanel';
import type { SpendingInsight } from './InsightsPanel';

afterEach(cleanup);

const sampleInsight: SpendingInsight = {
  monthKey: '2026-05',
  headline: 'Grocery spend is quietly climbing',
  observations: [
    'Groceries have risen for three straight months while dining out has not.',
    'One-off purchases cluster in months following a low-spend month.'
  ],
  prediction: 'Expect June card spend to land above the trailing average.',
  generatedAt: 1_780_000_000_000
};

describe('InsightsPanel', () => {
  it('keeps the coming soon empty state when no insight exists', () => {
    render(<InsightsPanel insight={null} />);

    expect(screen.queryByText("You're in good shape")).toBeNull();
    expect(screen.getByText('Personalised insights coming soon')).toBeDefined();
  });

  it('renders the headline, observations, and prediction of a stored insight', () => {
    render(<InsightsPanel insight={sampleInsight} />);

    expect(screen.getByText('Grocery spend is quietly climbing')).toBeDefined();
    for (const observation of sampleInsight.observations) {
      expect(screen.getByText(observation)).toBeDefined();
    }
    expect(screen.getByText('Expect June card spend to land above the trailing average.')).toBeDefined();
    expect(screen.queryByText('Personalised insights coming soon')).toBeNull();
  });

  it('labels the insight with its month', () => {
    render(<InsightsPanel insight={sampleInsight} />);

    expect(screen.getByText('May 2026')).toBeDefined();
  });

  it('stays collapsed until the large dashboard breakpoint', () => {
    const { container } = render(<InsightsPanel />);
    const panel = container.querySelector('aside');

    expect(panel?.className).toContain('hidden');
    expect(panel?.className).toContain('lg:flex');
  });
});
