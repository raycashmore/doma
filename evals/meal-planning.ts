import { buildMealPlannerInput, buildWeeklyMealPlan } from '../apps/api-bot/src/capabilities/mealPlanning.ts';
import { runEvalCases, type EvalFailure } from './shared/grader.ts';
import { renderScorecard, summarizeEvalResults } from './shared/report.ts';

type MealEvalInput = Parameters<typeof buildMealPlannerInput>[0];
type MealEvalExpect = {
  shouldPlan: boolean;
  recipeTitles: string[];
  ingredientTitles: string[];
  busyWeekdayDinner?: { weekday: string; recipeTitle: string };
};

const cases: Array<{ id: string; input: MealEvalInput; expect: MealEvalExpect }> = [
  {
    id: 'meal-grounding-leftovers-001',
    input: {
      recipes: [
        { title: 'Generic pasta', ingredients: 'Pasta\nSauce', prepMinutes: 20, mealType: 'Dinner with leftovers' },
        { title: 'Generic lunch', ingredients: 'Bread\nFruit', prepMinutes: 5, mealType: 'Lunch' },
        { title: 'Missing ingredients', ingredients: ' ', prepMinutes: 5, mealType: 'Dinner' }
      ],
      activeShoppingItemTitles: []
    },
    expect: {
      shouldPlan: true,
      recipeTitles: ['Generic pasta', 'Generic lunch'],
      ingredientTitles: ['Pasta', 'Sauce', 'Bread', 'Fruit']
    }
  },
  {
    id: 'meal-avoid-ingredient-002',
    input: {
      recipes: [
        { title: 'Avoided dinner', ingredients: 'Generic ingredient', prepMinutes: 10, mealType: 'Dinner' },
        { title: 'Eligible dinner', ingredients: 'Alternative ingredient', prepMinutes: 30, mealType: 'Dinner' },
        { title: 'Generic lunch', ingredients: 'Bread', prepMinutes: 5, mealType: 'Lunch' }
      ],
      activeShoppingItemTitles: [],
      avoidIngredient: 'Generic ingredient'
    },
    expect: {
      shouldPlan: true,
      recipeTitles: ['Eligible dinner', 'Generic lunch'],
      ingredientTitles: ['Alternative ingredient', 'Bread']
    }
  },
  {
    id: 'meal-busy-weekday-003',
    input: {
      recipes: [
        { title: 'Slow dinner', ingredients: 'Slow ingredient', prepMinutes: 45, mealType: 'Dinner' },
        { title: 'Quick dinner', ingredients: 'Quick ingredient', prepMinutes: 10, mealType: 'Dinner' },
        { title: 'Generic lunch', ingredients: 'Bread', prepMinutes: 5, mealType: 'Lunch' }
      ],
      activeShoppingItemTitles: [],
      busyWeekdays: ['Tuesday']
    },
    expect: {
      shouldPlan: true,
      recipeTitles: ['Slow dinner', 'Quick dinner', 'Generic lunch'],
      ingredientTitles: ['Slow ingredient', 'Quick ingredient', 'Bread'],
      busyWeekdayDinner: { weekday: 'Tuesday', recipeTitle: 'Quick dinner' }
    }
  },
  {
    id: 'meal-insufficient-lunch-004',
    input: {
      recipes: [{ title: 'Dinner only', ingredients: 'Generic ingredient', prepMinutes: 20, mealType: 'Dinner' }],
      activeShoppingItemTitles: []
    },
    expect: { shouldPlan: false, recipeTitles: [], ingredientTitles: [] }
  },
  {
    id: 'meal-shopping-dedup-005',
    input: {
      recipes: [
        {
          title: 'Generic dinner',
          ingredients: 'Already active\nNeeded ingredient',
          prepMinutes: 20,
          mealType: 'Dinner'
        },
        {
          title: 'Generic lunch',
          ingredients: 'Needed ingredient\nLunch ingredient',
          prepMinutes: 5,
          mealType: 'Lunch'
        }
      ],
      activeShoppingItemTitles: ['already active']
    },
    expect: {
      shouldPlan: true,
      recipeTitles: ['Generic dinner', 'Generic lunch'],
      ingredientTitles: ['Needed ingredient', 'Lunch ingredient']
    }
  }
];

export async function runMealPlanningEvals() {
  const results = await runEvalCases({
    cases,
    execute: (testCase) => buildWeeklyMealPlan(buildMealPlannerInput(testCase.input)),
    graders: [groundingGrader]
  });
  return { results, summary: summarizeEvalResults(results) };
}

function groundingGrader({
  testCase,
  output
}: {
  testCase: (typeof cases)[number];
  output: ReturnType<typeof buildWeeklyMealPlan>;
}): EvalFailure[] {
  if (!testCase.expect.shouldPlan) {
    return output === null
      ? []
      : [failure('insufficient-coverage', 'Expected insufficient recipe coverage to avoid invented lunch ideas.')];
  }
  if (!output) return [failure('insufficient-coverage', 'Expected a grounded plan but received no plan.')];

  const selectedRecipes = output.days.flatMap((day) => [day.dinnerRecipeTitle, day.lunch.recipeTitle]);
  const inventedRecipe = selectedRecipes.find((title) => !testCase.expect.recipeTitles.includes(title));
  if (inventedRecipe) return [failure('recipe-grounding', `Selected unsupported recipe: ${inventedRecipe}`)];
  const inventedIngredient = output.ingredientDraft.find((title) => !testCase.expect.ingredientTitles.includes(title));
  if (inventedIngredient)
    return [failure('ingredient-grounding', `Included unsupported ingredient: ${inventedIngredient}`)];
  const duplicateIngredient = output.ingredientDraft.find((title, index, titles) => titles.indexOf(title) !== index);
  if (duplicateIngredient)
    return [failure('ingredient-deduplication', `Included duplicate ingredient: ${duplicateIngredient}`)];
  if (testCase.expect.busyWeekdayDinner) {
    const actual = output.days.find((day) => day.weekday === testCase.expect.busyWeekdayDinner!.weekday);
    if (actual?.dinnerRecipeTitle !== testCase.expect.busyWeekdayDinner.recipeTitle) {
      return [
        failure(
          'schedule-fit',
          `Expected ${testCase.expect.busyWeekdayDinner.recipeTitle} on ${testCase.expect.busyWeekdayDinner.weekday}.`
        )
      ];
    }
  }
  return [];
}

function failure(category: string, message: string): EvalFailure {
  return { category, message, launchBlocking: true };
}

if (import.meta.url === new URL(process.argv[1]!, 'file:').href) {
  const { summary } = await runMealPlanningEvals();
  console.log(renderScorecard('Weekly meal-planning evals', summary));
  if (summary.launchBlockers > 0) process.exitCode = 1;
}
