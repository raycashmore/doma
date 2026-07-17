import { z } from 'zod';

export const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] as const;
export const mealTypes = ['schoolLunch', 'dinner'] as const;

export const weekdaySchema = z.enum(weekdays);
export const mealTypeSchema = z.enum(mealTypes);

export const mealSlotSchema = z.object({
  day: weekdaySchema,
  meal: mealTypeSchema
});

export const openMealSlotsSchema = z.object({
  weekStart: z.string(),
  planUpdatedAt: z.number().nullable(),
  slots: z.array(mealSlotSchema)
});

export const savedRecipeSchema = z.object({
  publicId: z.string(),
  name: z.string(),
  description: z.string(),
  preparationTime: z.string(),
  mealSuitabilityTags: z.array(z.string())
});

export const dayBusynessSchema = z.object({
  day: weekdaySchema,
  level: z.enum(['quiet', 'normal', 'busy'])
});

export const proposedAssignmentSchema = mealSlotSchema.extend({
  recipePublicId: z.string(),
  reason: z.string().min(1).max(240)
});

export const weeklyMealsOutcomeSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('proposal'),
    assignments: z.array(proposedAssignmentSchema).min(1)
  }),
  z.object({
    kind: z.literal('cannotPropose'),
    reason: z.string().min(1).max(320)
  })
]);

export const weeklyMealsRunInputSchema = z.object({
  userId: z.string().min(1),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  expectedPlanUpdatedAt: z.number().nullable(),
  instruction: z.string().trim().max(500).optional()
});

export type Weekday = z.infer<typeof weekdaySchema>;
export type MealType = z.infer<typeof mealTypeSchema>;
export type MealSlot = z.infer<typeof mealSlotSchema>;
export type OpenMealSlots = z.infer<typeof openMealSlotsSchema>;
export type SavedRecipe = z.infer<typeof savedRecipeSchema>;
export type DayBusyness = z.infer<typeof dayBusynessSchema>;
export type WeeklyMealsOutcome = z.infer<typeof weeklyMealsOutcomeSchema>;
export type WeeklyMealsRunInput = z.infer<typeof weeklyMealsRunInputSchema>;
