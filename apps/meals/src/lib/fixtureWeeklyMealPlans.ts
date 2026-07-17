import { getNextWeekStart, setWeeklyMealAssignment } from '@repo/convex/meals/model';
import { listFixtureRecipes } from './fixtureRecipes';
import type { WeeklyMealAssignment, WeeklyMealAssignmentChange } from '@repo/convex/meals/model';

import type { WeeklyMealProposal } from '@/components/meals/weeklyMealPlannerModel';

const STORAGE_KEY = 'doma.meals.fixture-weekly-plans.v1';
const proposals = new Map<string, { weekStart: string; assignments: Array<WeeklyMealAssignment> }>();

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

export function createFixtureWeeklyMealProposal(weekStart: string, instruction?: string): WeeklyMealProposal {
  const plan = getFixtureWeeklyMealPlan(weekStart);
  const occupied = new Set(plan.assignments.map(({ day, meal }) => `${day}:${meal}`));
  const used = new Set(plan.assignments.map(({ recipePublicId }) => recipePublicId));
  const recipes = listFixtureRecipes();
  const assignments = (['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const).flatMap((day) =>
    (['schoolLunch', 'dinner'] as const).flatMap((meal) => {
      if (occupied.has(`${day}:${meal}`)) return [];
      const tag = meal === 'schoolLunch' ? 'School lunch' : 'Dinner';
      const candidates = recipes.filter((recipe) => recipe.mealSuitabilityTags.includes(tag));
      const recipe = candidates.find((candidate) => !used.has(candidate.publicId)) ?? candidates[0];
      used.add(recipe.publicId);
      return [
        {
          day,
          meal,
          recipePublicId: recipe.publicId,
          reason: instruction
            ? `Fits the request and uses a saved ${tag.toLowerCase()} recipe.`
            : `A suitable saved ${tag.toLowerCase()} recipe for this open slot.`
        }
      ];
    })
  );
  if (!assignments.length)
    return {
      runId: 'fixture_none',
      outcome: { kind: 'cannotPropose', reason: 'There are no empty meal slots to fill.' }
    };
  const runId = `fixture_${weekStart}_${Date.now()}`;
  proposals.set(runId, {
    weekStart,
    assignments: assignments.map((assignment) => ({
      day: assignment.day,
      meal: assignment.meal,
      recipePublicId: assignment.recipePublicId
    }))
  });
  return { runId, outcome: { kind: 'proposal', assignments } };
}

export function applyFixtureWeeklyMealProposal(runId: string) {
  const proposal = proposals.get(runId);
  if (!proposal) throw new Error('Meal proposal unavailable');
  const plan = getFixtureWeeklyMealPlan(proposal.weekStart);
  for (const assignment of proposal.assignments) {
    if (plan.assignments.some((current) => current.day === assignment.day && current.meal === assignment.meal)) {
      throw new Error('Meal proposal is stale');
    }
  }
  const assignments = proposal.assignments.reduce(
    (current, assignment) => setWeeklyMealAssignment(current, assignment),
    plan.assignments
  );
  const store = readStore();
  store[proposal.weekStart] = assignments;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  proposals.delete(runId);
  return { weekStart: proposal.weekStart, assignments: cloneAssignments(assignments) };
}
