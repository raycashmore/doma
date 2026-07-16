export type RecipeView = {
  publicId: string;
  name: string;
  description: string;
  preparationTime: string;
  servingsLabel: string;
  mealSuitabilityTags: Array<string>;
  ingredientLines: Array<string>;
  instructions: string;
};

export type RecipeFormValue = Omit<RecipeView, 'publicId'>;
