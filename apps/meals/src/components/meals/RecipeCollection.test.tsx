import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { RecipeCollection } from './RecipeCollection';

afterEach(cleanup);

const recipes = [
  {
    publicId: 'recipe_wraps',
    name: 'Veggie wraps',
    description: 'A quick school lunch.',
    preparationTime: '20 min',
    servingsLabel: 'Serves 4',
    mealSuitabilityTags: ['School lunch', 'Quick'],
    ingredientLines: ['4 wraps'],
    instructions: 'Fill and roll.'
  },
  {
    publicId: 'recipe_tray',
    name: 'Chicken tray bake',
    description: 'A dependable dinner.',
    preparationTime: '40 min',
    servingsLabel: 'Serves 4–6',
    mealSuitabilityTags: ['Dinner', 'Favourite'],
    ingredientLines: ['4 chicken thighs'],
    instructions: 'Roast until cooked.'
  }
];

describe('RecipeCollection', () => {
  it('shows a clear empty state with a create action', () => {
    render(<RecipeCollection recipes={[]} />);

    expect(screen.getByText('Your repertoire starts here')).toBeDefined();
    expect(screen.getByRole('link', { name: 'Add your first meal' }).getAttribute('href')).toBe('/meals/recipes/new');
  });

  it('filters recipes by search and suitability', () => {
    render(<RecipeCollection recipes={recipes} />);

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search your meals' }), {
      target: { value: 'chicken' }
    });
    expect(screen.getByText('Chicken tray bake')).toBeDefined();
    expect(screen.queryByText('Veggie wraps')).toBeNull();

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search your meals' }), {
      target: { value: '' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'School lunch' }));
    expect(screen.getByText('Veggie wraps')).toBeDefined();
    expect(screen.queryByText('Chicken tray bake')).toBeNull();
  });
});
