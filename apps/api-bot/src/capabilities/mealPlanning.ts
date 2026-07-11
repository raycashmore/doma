export type MealPlannerRecipe = {
  title: string;
  ingredients: string[];
  serves: number | null;
  prepMinutes: number | null;
  mealType: string | null;
};

export type MealPlannerInput = {
  recipes: MealPlannerRecipe[];
  activeShoppingItemTitles: string[];
  busyWeekdays?: string[];
};

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] as const;

type RawRecipe = {
  title: string;
  ingredients: string;
  serves?: number | null;
  prepMinutes?: number | null;
  mealType?: string | null;
};

function normalizedIngredientLines(value: string) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function normalizedShoppingItemTitles(titles: string[]) {
  return [...new Set(titles.map((title) => title.trim().toLowerCase()).filter(Boolean))];
}

/**
 * Convert the recipe-list data into the small, trustworthy input contract for
 * the planning provider. Recipes without explicit ingredient lines are omitted
 * rather than leaving a model to fill them in from general knowledge.
 */
export function buildMealPlannerInput({
  recipes,
  activeShoppingItemTitles,
  busyWeekdays = []
}: {
  recipes: RawRecipe[];
  activeShoppingItemTitles: string[];
  busyWeekdays?: string[];
}): MealPlannerInput {
  return {
    recipes: recipes.flatMap((recipe) => {
      const title = recipe.title.trim();
      const ingredients = normalizedIngredientLines(recipe.ingredients);
      if (!title || ingredients.length === 0) return [];

      return [
        {
          title,
          ingredients,
          serves: recipe.serves ?? null,
          prepMinutes: recipe.prepMinutes ?? null,
          mealType: recipe.mealType?.trim() || null
        }
      ];
    }),
    activeShoppingItemTitles: normalizedShoppingItemTitles(activeShoppingItemTitles),
    busyWeekdays: [...new Set(busyWeekdays)]
  };
}

/**
 * Produce a deterministic, grounded plan while the capability has no planning
 * provider configured. Recipes are ordered by preparation time, so the fastest
 * available option lands on the first weekday. Every later capability layer
 * receives the same narrow result contract.
 */
export function buildWeeklyMealPlan(input: MealPlannerInput) {
  const recipes = [...input.recipes].sort(
    (left, right) => (left.prepMinutes ?? Number.MAX_SAFE_INTEGER) - (right.prepMinutes ?? Number.MAX_SAFE_INTEGER)
  );
  if (recipes.length === 0) return null;

  const activeShoppingItems = new Set(input.activeShoppingItemTitles);
  const selectedRecipeTitles = new Set<string>();
  const ingredientDraft: string[] = [];
  const seenIngredientTitles = new Set<string>();

  const busyWeekdays = new Set(input.busyWeekdays ?? []);
  const slowestFirst = [...recipes].reverse();
  let quickIndex = 0;
  let slowIndex = 0;
  const days = WEEKDAYS.map((weekday) => {
    const candidates = busyWeekdays.has(weekday) ? recipes : slowestFirst;
    const index = busyWeekdays.has(weekday) ? quickIndex++ : slowIndex++;
    const recipe = candidates[index % candidates.length]!;
    selectedRecipeTitles.add(recipe.title);
    return { weekday, dinnerRecipeTitle: recipe.title };
  });

  for (const recipe of recipes) {
    if (!selectedRecipeTitles.has(recipe.title)) continue;
    for (const ingredient of recipe.ingredients) {
      const normalized = ingredient.toLowerCase();
      if (activeShoppingItems.has(normalized) || seenIngredientTitles.has(normalized)) continue;
      seenIngredientTitles.add(normalized);
      ingredientDraft.push(ingredient);
    }
  }

  return { days, ingredientDraft };
}
