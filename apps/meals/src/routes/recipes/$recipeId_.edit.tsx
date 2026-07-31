import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@repo/convex';

import type { RecipeFormValue } from '@/components/meals/types';
import { RecipeForm } from '@/components/meals/RecipeForm';
import { FIXTURE_MODE } from '@/config/runtime';
import { getFixtureRecipe, updateFixtureRecipe } from '@/lib/fixtureRecipes';

export const Route = createFileRoute('/recipes/$recipeId_/edit')({ ssr: !FIXTURE_MODE, component: EditRecipeRoute });

function EditRecipeRoute() {
  const { recipeId } = Route.useParams();
  const queriedRecipe = useQuery(api.meals.queries.getRecipeByPublicId, FIXTURE_MODE ? 'skip' : { publicId: recipeId });
  const recipe = FIXTURE_MODE ? getFixtureRecipe(recipeId) : queriedRecipe;
  const updateRecipe = useMutation(api.meals.mutations.updateRecipe);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  if (recipe === undefined) return <div className="h-full rounded-[28px] bg-warm-bg-card" aria-label="Loading meal" />;
  if (recipe === null)
    return (
      <div className="flex h-full items-center justify-center rounded-[28px] bg-warm-bg-card text-sm text-warm-text-secondary">
        Recipe unavailable.
      </div>
    );

  const initialValue: RecipeFormValue = {
    name: recipe.name,
    description: recipe.description,
    preparationTime: recipe.preparationTime,
    servingsLabel: recipe.servingsLabel,
    mealSuitabilityTags: recipe.mealSuitabilityTags,
    ingredientLines: recipe.ingredientLines,
    instructions: recipe.instructions
  };

  async function handleSubmit(value: RecipeFormValue) {
    setSubmitting(true);
    setSubmitError('');
    try {
      if (FIXTURE_MODE) updateFixtureRecipe(recipeId, value);
      else await updateRecipe({ publicId: recipeId, ...value });
      await navigate({ to: '/recipes/$recipeId', params: { recipeId } });
    } catch {
      setSubmitError('The meal could not be saved. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <RecipeForm
      mode="edit"
      initialValue={initialValue}
      onSubmit={handleSubmit}
      submitting={submitting}
      submitError={submitError}
      cancelRecipeId={recipeId}
    />
  );
}
