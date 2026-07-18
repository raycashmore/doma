import type {
  Weekday,
  WeeklyMealAssignment,
  WeeklyMealAssignmentChange,
  WeeklyMealType
} from '@repo/convex/meals/model';

import type { RecipeView } from './types';

export type WeeklyMealPlanView = {
  weekStart: string;
  assignments: Array<WeeklyMealAssignment>;
  updatedAt?: number;
};

export type WeeklyMealProposal = {
  runId: string;
  outcome:
    | {
        kind: 'proposal';
        assignments: Array<WeeklyMealAssignment & { reason: string }>;
      }
    | { kind: 'cannotPropose'; reason: string };
};

export type SlotSelection = Pick<WeeklyMealAssignmentChange, 'day' | 'meal'>;

export type WeeklyMealPlannerProps = {
  recipes: Array<RecipeView>;
  plan: WeeklyMealPlanView;
  onWeekChange: (weekDelta: number) => void;
  onAssignmentChange: (change: WeeklyMealAssignmentChange) => void | Promise<void>;
  onRequestSuggestions?: (instruction?: string) => Promise<WeeklyMealProposal>;
  onApplyProposal?: (runId: string) => void | Promise<void>;
};

export type ShoppingRow = {
  id: string;
  line: string;
  recipeName: string;
};

export const DAY_NAMES = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday'
} satisfies Record<Weekday, string>;

export const MEAL_NAMES = {
  schoolLunch: 'school lunch',
  dinner: 'dinner'
} satisfies Record<WeeklyMealType, string>;

export function formatDate(date: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat('en-AU', { ...options, timeZone: 'UTC' }).format(new Date(`${date}T00:00:00.000Z`));
}

export function formatWeekRange(dates: Array<string>) {
  const formatRangeDate = (date: string) =>
    [
      formatDate(date, { weekday: 'short' }),
      formatDate(date, { day: 'numeric' }),
      formatDate(date, { month: 'short' })
    ].join(' ');
  const first = formatRangeDate(dates[0] ?? '');
  const last = formatRangeDate(dates[4] ?? '');
  return `${first} – ${last}`;
}

export function findAssignment(assignments: Array<WeeklyMealAssignment>, day: Weekday, meal: WeeklyMealType) {
  return assignments.find((assignment) => assignment.day === day && assignment.meal === meal);
}
