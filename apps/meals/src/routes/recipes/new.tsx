import { useState } from 'react';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useMutation } from 'convex/react';
import { api } from '@repo/convex';

import type { RecipeFormValue } from '@/components/meals/types';
import { RecipeForm } from '@/components/meals/RecipeForm';
import { getMealsBaseUrl } from '@/config/basePath';
import { createFixtureRecipe } from '@/lib/fixtureRecipes';

const FIXTURE_MODE = !import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
// eslint-disable-next-line turbo/no-undeclared-env-vars
const APP_BASE_URL = getMealsBaseUrl(import.meta.env.DEV);

export const Route = createFileRoute('/recipes/new')({ ssr: !FIXTURE_MODE, component: NewRecipeRoute });

function NewRecipeRoute() {
  const createRecipe = useMutation(api.meals.mutations.createRecipe);
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  async function handleSubmit(value: RecipeFormValue) {
    setSubmitting(true);
    setSubmitError('');
    try {
      const recipe = FIXTURE_MODE ? createFixtureRecipe(value) : await createRecipe(value);
      await navigate({ to: '/recipes/$recipeId', params: { recipeId: recipe.publicId } });
    } catch {
      setSubmitError('The meal could not be saved. Try again.');
      setSubmitting(false);
    }
  }

  return (
    <RecipeForm
      mode="create"
      onSubmit={handleSubmit}
      submitting={submitting}
      submitError={submitError}
      baseUrl={APP_BASE_URL}
    />
  );
}
