export type RecipeInput = {
  name: string;
  description: string;
  preparationTime: string;
  servingsLabel: string;
  mealSuitabilityTags: string[];
  ingredientLines: string[];
  instructions: string;
};

export const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
export const WEEKLY_MEAL_TYPES = ['schoolLunch', 'dinner'] as const;
export const DEFAULT_MEALS_TIME_ZONE = 'Australia/Sydney';

export type Weekday = (typeof WEEKDAYS)[number];
export type WeeklyMealType = (typeof WEEKLY_MEAL_TYPES)[number];
export type WeeklyMealAssignment = {
  day: Weekday;
  meal: WeeklyMealType;
  recipePublicId: string;
};
export type WeeklyMealAssignmentChange = Omit<WeeklyMealAssignment, 'recipePublicId'> & {
  recipePublicId: string | null;
};

function parseCalendarDate(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid calendar date');
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid calendar date');
  }
  return date;
}

function formatCalendarDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function getWeekDates(weekStart: string): string[] {
  const monday = parseCalendarDate(weekStart);
  if (monday.getUTCDay() !== 1) throw new Error('Week start must be a Monday');

  return WEEKDAYS.map((_, index) => {
    const date = new Date(monday);
    date.setUTCDate(monday.getUTCDate() + index);
    return formatCalendarDate(date);
  });
}

export function shiftWeekStart(weekStart: string, weekDelta: number): string {
  const monday = parseCalendarDate(weekStart);
  if (monday.getUTCDay() !== 1) throw new Error('Week start must be a Monday');
  monday.setUTCDate(monday.getUTCDate() + weekDelta * 7);
  return formatCalendarDate(monday);
}

export function getNextWeekStart(now: Date, timeZone = DEFAULT_MEALS_TIME_ZONE): string {
  const calendarParts = new Intl.DateTimeFormat('en-AU', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  })
    .formatToParts(now)
    .reduce<Record<string, string>>((parts, part) => {
      if (part.type !== 'literal') parts[part.type] = part.value;
      return parts;
    }, {});
  const date = parseCalendarDate(`${calendarParts.year}-${calendarParts.month}-${calendarParts.day}`);
  const daysUntilMonday = (8 - date.getUTCDay()) % 7 || 7;
  date.setUTCDate(date.getUTCDate() + daysUntilMonday);
  return formatCalendarDate(date);
}

export function setWeeklyMealAssignment(
  assignments: WeeklyMealAssignment[],
  assignment: WeeklyMealAssignmentChange
): WeeklyMealAssignment[] {
  const dayIndex = WEEKDAYS.indexOf(assignment.day);
  const mealIndex = WEEKLY_MEAL_TYPES.indexOf(assignment.meal);
  if (dayIndex < 0 || mealIndex < 0) throw new Error('Invalid weekly meal slot');

  const nextAssignments = assignments.filter(
    (existing) => existing.day !== assignment.day || existing.meal !== assignment.meal
  );
  if (assignment.recipePublicId) {
    nextAssignments.push({ ...assignment, recipePublicId: assignment.recipePublicId });
  }

  return nextAssignments.sort((left, right) => {
    const dayDifference = WEEKDAYS.indexOf(left.day) - WEEKDAYS.indexOf(right.day);
    return dayDifference || WEEKLY_MEAL_TYPES.indexOf(left.meal) - WEEKLY_MEAL_TYPES.indexOf(right.meal);
  });
}

export function normalizeRecipeInput(input: RecipeInput): RecipeInput {
  const name = input.name.trim();
  if (!name) throw new Error('Recipe name is required');

  const ingredientLines = input.ingredientLines.map((line) => line.trim()).filter(Boolean);
  if (!ingredientLines.length) throw new Error('At least one ingredient is required');

  const instructions = input.instructions.trim();
  if (!instructions) throw new Error('Recipe instructions are required');

  return {
    name,
    description: input.description.trim(),
    preparationTime: input.preparationTime.trim(),
    servingsLabel: input.servingsLabel.trim(),
    mealSuitabilityTags: Array.from(new Set(input.mealSuitabilityTags.map((tag) => tag.trim()).filter(Boolean))),
    ingredientLines,
    instructions
  };
}

export function buildRecipePublicId(seed: string): string {
  return `recipe_${seed}`;
}
