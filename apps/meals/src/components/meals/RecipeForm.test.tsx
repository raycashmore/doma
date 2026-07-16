import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RecipeForm } from './RecipeForm';

afterEach(cleanup);

describe('RecipeForm', () => {
  it('collects ordered ingredient lines and submits a recipe', () => {
    const onSubmit = vi.fn();
    render(<RecipeForm mode="create" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Veggie wraps' } });
    fireEvent.change(screen.getByLabelText('Short description'), { target: { value: 'A quick school lunch.' } });
    fireEvent.change(screen.getByLabelText('Prep time'), { target: { value: '20 min' } });
    fireEvent.change(screen.getByLabelText('Servings'), { target: { value: 'Serves 4' } });
    fireEvent.click(screen.getByRole('button', { name: 'School lunch' }));
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: '4 wraps' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add ingredient line' }));
    fireEvent.change(screen.getByLabelText('Ingredient 2'), { target: { value: '2 carrots' } });
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Fill and roll.' } });
    fireEvent.submit(screen.getAllByRole('button', { name: 'Save meal' })[0].closest('form')!);

    expect(onSubmit).toHaveBeenCalledWith({
      name: 'Veggie wraps',
      description: 'A quick school lunch.',
      preparationTime: '20 min',
      servingsLabel: 'Serves 4',
      mealSuitabilityTags: ['School lunch'],
      ingredientLines: ['4 wraps', '2 carrots'],
      instructions: 'Fill and roll.'
    });
  });

  it('shows validation feedback before submitting an incomplete recipe', () => {
    const onSubmit = vi.fn();
    render(<RecipeForm mode="create" onSubmit={onSubmit} />);

    fireEvent.submit(screen.getAllByRole('button', { name: 'Save meal' })[0].closest('form')!);

    expect(screen.getByRole('alert').textContent).toContain(
      'Add a meal name, at least one ingredient, and instructions.'
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('lets ingredient lines be reordered without losing their values', () => {
    const onSubmit = vi.fn();
    render(<RecipeForm mode="create" onSubmit={onSubmit} />);

    fireEvent.change(screen.getByLabelText('Meal name'), { target: { value: 'Tomato toast' } });
    fireEvent.change(screen.getByLabelText('Ingredient 1'), { target: { value: 'Toast' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add ingredient line' }));
    fireEvent.change(screen.getByLabelText('Ingredient 2'), { target: { value: 'Tomatoes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Move ingredient 2 up' }));
    fireEvent.change(screen.getByLabelText('Instructions'), { target: { value: 'Top and serve.' } });
    fireEvent.submit(screen.getAllByRole('button', { name: 'Save meal' })[0].closest('form')!);

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ ingredientLines: ['Tomatoes', 'Toast'] }));
  });
});
