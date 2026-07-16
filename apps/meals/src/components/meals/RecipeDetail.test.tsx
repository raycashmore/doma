import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecipeDetail } from './RecipeDetail';
import type { ReactNode } from 'react';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>
}));

afterEach(cleanup);

describe('RecipeDetail', () => {
  it('renders ingredient lines in their saved order', () => {
    render(
      <RecipeDetail
        recipe={{
          publicId: 'recipe_tray',
          name: 'Chicken tray bake',
          description: 'A dependable dinner.',
          preparationTime: '40 min',
          servingsLabel: 'Serves 4–6',
          mealSuitabilityTags: ['Dinner', 'Favourite'],
          ingredientLines: ['4 chicken thighs', '600 g baby potatoes', '3 carrots'],
          instructions: 'Roast the chicken and vegetables until cooked.'
        }}
      />
    );

    const items = screen.getAllByRole('listitem').map((item) => item.textContent);
    expect(items).toEqual(['4 chicken thighs', '600 g baby potatoes', '3 carrots']);
    expect(screen.getByText('Roast the chicken and vegetables until cooked.')).toBeDefined();
  });

  it('renders duplicate free-form ingredient lines', () => {
    render(
      <RecipeDetail
        recipe={{
          publicId: 'recipe_toast',
          name: 'Toast',
          description: '',
          preparationTime: '',
          servingsLabel: '',
          mealSuitabilityTags: [],
          ingredientLines: ['1 slice bread', '1 slice bread'],
          instructions: 'Toast both slices.'
        }}
      />
    );

    expect(screen.getAllByText('1 slice bread')).toHaveLength(2);
  });
});
