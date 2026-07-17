import { getNextWeekStart, setWeeklyMealAssignment } from '@repo/convex/meals/model';
import type { WeeklyMealAssignment, WeeklyMealAssignmentChange } from '@repo/convex/meals/model';

const STORAGE_KEY = 'doma.meals.fixture-weekly-plans.v1';

const INITIAL_ASSIGNMENTS = [
  { day: 'monday', meal: 'schoolLunch', recipePublicId: 'recipe_veggie_wraps' },
  { day: 'monday', meal: 'dinner', recipePublicId: 'recipe_chicken_tray_bake' },
  { day: 'tuesday', meal: 'schoolLunch', recipePublicId: 'recipe_soup_toast' },
  { day: 'tuesday', meal: 'dinner', recipePublicId: 'recipe_pasta_bake' },
  { day: 'wednesday', meal: 'schoolLunch', recipePublicId: 'recipe_rice_bowls' },
  { day: 'wednesday', meal: 'dinner', recipePublicId: 'recipe_bean_quesadillas' },
  { day: 'thursday', meal: 'schoolLunch', recipePublicId: 'recipe_salmon_rice_tray' },
  { day: 'thursday', meal: 'dinner', recipePublicId: 'recipe_lentil_bolognese' },
  { day: 'friday', meal: 'schoolLunch', recipePublicId: 'recipe_egg_fried_rice' }
] satisfies Array<WeeklyMealAssignment>;

type FixturePlanStore = Partial<Record<string, Array<WeeklyMealAssignment>>>;

function cloneAssignments(assignments: Array<WeeklyMealAssignment>) {
  return assignments.map((assignment) => ({ ...assignment }));
}

function readStore(): FixturePlanStore {
  if (typeof localStorage === 'undefined') return {};
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return {};
  try {
    return JSON.parse(stored) as FixturePlanStore;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return {};
  }
}

export function getFixtureWeeklyMealPlan(weekStart: string) {
  const stored = readStore()[weekStart];
  const assignments = stored ?? (weekStart === getNextWeekStart(new Date()) ? INITIAL_ASSIGNMENTS : []);
  return { weekStart, assignments: cloneAssignments(assignments) };
}

export function setFixtureWeeklyMealAssignment(
  args: WeeklyMealAssignmentChange & {
    weekStart: string;
  }
) {
  const store = readStore();
  const current = getFixtureWeeklyMealPlan(args.weekStart);
  const assignments = setWeeklyMealAssignment(current.assignments, args);
  store[args.weekStart] = assignments;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  return { weekStart: args.weekStart, assignments: cloneAssignments(assignments) };
}
