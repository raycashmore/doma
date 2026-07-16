import type { RecipeFormValue, RecipeView } from '@/components/meals/types';

const INITIAL_RECIPES = [
  {
    publicId: 'recipe_veggie_wraps',
    name: 'Veggie wraps',
    description: 'A quick, colourful school lunch.',
    preparationTime: '20 min',
    servingsLabel: 'Serves 4',
    mealSuitabilityTags: ['School lunch', 'Quick'],
    ingredientLines: ['4 wraps', '1 carrot', '1 cucumber', '200 g hummus'],
    instructions: 'Spread each wrap with hummus. Add the sliced vegetables, fold the edges in, and roll tightly.'
  },
  {
    publicId: 'recipe_chicken_tray_bake',
    name: 'Chicken tray bake',
    description: 'A dependable one-tray dinner.',
    preparationTime: '40 min',
    servingsLabel: 'Serves 4–6',
    mealSuitabilityTags: ['Dinner', 'Favourite'],
    ingredientLines: ['4 chicken thighs', '600 g baby potatoes', '3 carrots', '1 head broccoli', '2 tbsp olive oil'],
    instructions:
      'Heat the oven to 210°C. Add the chicken and vegetables to a large tray, drizzle with oil and season. Roast for 30–35 minutes, turning once.'
  },
  {
    publicId: 'recipe_pasta_bake',
    name: 'Pasta bake',
    description: 'Easy comfort food for busy nights.',
    preparationTime: '45 min',
    servingsLabel: 'Serves 6',
    mealSuitabilityTags: ['Dinner'],
    ingredientLines: ['400 g pasta', '500 ml tomato sauce', '200 g mozzarella'],
    instructions: 'Cook the pasta until just tender. Stir through the sauce, top with cheese, and bake until golden.'
  },
  {
    publicId: 'recipe_rice_bowls',
    name: 'Rice bowls',
    description: 'Build-your-own bowls for everyone.',
    preparationTime: '25 min',
    servingsLabel: 'Serves 4',
    mealSuitabilityTags: ['Dinner', 'Quick'],
    ingredientLines: ['2 cups cooked rice', '2 cups mixed vegetables', '4 eggs'],
    instructions:
      'Divide the warm rice between bowls. Add vegetables and a cooked egg, then finish with your preferred dressing.'
  },
  {
    publicId: 'recipe_soup_toast',
    name: 'Soup and toast',
    description: 'A simple lunch for cooler days.',
    preparationTime: '20 min',
    servingsLabel: 'Serves 4',
    mealSuitabilityTags: ['School lunch', 'Quick'],
    ingredientLines: ['1 litre vegetable soup', '8 slices bread'],
    instructions: 'Warm the soup and serve with toasted bread.'
  },
  {
    publicId: 'recipe_bean_quesadillas',
    name: 'Bean quesadillas',
    description: 'Crisp tortillas with a mild filling.',
    preparationTime: '25 min',
    servingsLabel: 'Serves 4',
    mealSuitabilityTags: ['Dinner', 'Quick'],
    ingredientLines: ['8 tortillas', '400 g beans', '150 g cheese'],
    instructions: 'Fill the tortillas, fold, and toast in a dry pan until crisp.'
  },
  {
    publicId: 'recipe_salmon_rice_tray',
    name: 'Salmon rice tray',
    description: 'An easy oven dinner with greens.',
    preparationTime: '35 min',
    servingsLabel: 'Serves 4',
    mealSuitabilityTags: ['Dinner'],
    ingredientLines: ['4 salmon fillets', '2 cups cooked rice', '2 cups greens'],
    instructions: 'Bake the salmon and greens, then serve over warm rice.'
  },
  {
    publicId: 'recipe_lentil_bolognese',
    name: 'Lentil bolognese',
    description: 'A vegetable-rich pasta sauce.',
    preparationTime: '40 min',
    servingsLabel: 'Serves 6',
    mealSuitabilityTags: ['Dinner', 'Favourite'],
    ingredientLines: ['400 g lentils', '500 ml tomato sauce', '400 g spaghetti'],
    instructions: 'Simmer the lentils in tomato sauce and serve with spaghetti.'
  },
  {
    publicId: 'recipe_egg_fried_rice',
    name: 'Egg fried rice',
    description: 'Fast dinner from cooked rice.',
    preparationTime: '15 min',
    servingsLabel: 'Serves 4',
    mealSuitabilityTags: ['Dinner', 'Quick'],
    ingredientLines: ['3 cups cooked rice', '4 eggs', '2 cups mixed vegetables'],
    instructions: 'Stir-fry the vegetables and rice, then fold through the cooked egg.'
  }
] satisfies Array<RecipeView>;

const STORAGE_KEY = 'doma.meals.fixture-recipes';

function cloneRecipes(source: Array<RecipeView>) {
  return source.map((recipe) => ({
    ...recipe,
    mealSuitabilityTags: [...recipe.mealSuitabilityTags],
    ingredientLines: [...recipe.ingredientLines]
  }));
}

function readStoredRecipes() {
  if (typeof localStorage === 'undefined') return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as Array<RecipeView>;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

function persistRecipes() {
  if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, JSON.stringify(recipes));
}

let recipes = cloneRecipes(readStoredRecipes() ?? INITIAL_RECIPES);
let nextFixtureId =
  Math.max(0, ...recipes.map((recipe) => Number(recipe.publicId.match(/^recipe_fixture_(\d+)$/)?.[1] ?? 0))) + 1;

export function listFixtureRecipes() {
  return cloneRecipes(recipes);
}

export function getFixtureRecipe(publicId: string) {
  return recipes.find((recipe) => recipe.publicId === publicId) ?? null;
}

export function createFixtureRecipe(value: RecipeFormValue) {
  const recipe = { publicId: `recipe_fixture_${nextFixtureId++}`, ...value } satisfies RecipeView;
  recipes = [recipe, ...recipes];
  persistRecipes();
  return recipe;
}

export function updateFixtureRecipe(publicId: string, value: RecipeFormValue) {
  if (!getFixtureRecipe(publicId)) throw new Error('Recipe unavailable');
  const updated = { publicId, ...value } satisfies RecipeView;
  recipes = recipes.map((recipe) => (recipe.publicId === publicId ? updated : recipe));
  persistRecipes();
  return updated;
}

export function resetFixtureRecipes() {
  recipes = cloneRecipes(INITIAL_RECIPES);
  nextFixtureId = 1;
  if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
}
