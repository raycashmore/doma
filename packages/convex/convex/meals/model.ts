export type RecipeInput = {
  name: string;
  description: string;
  preparationTime: string;
  servingsLabel: string;
  mealSuitabilityTags: string[];
  ingredientLines: string[];
  instructions: string;
};

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
