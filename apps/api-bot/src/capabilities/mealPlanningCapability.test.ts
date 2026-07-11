import { describe, expect, it } from 'vitest';

import { createMealPlanningCapability } from './mealPlanningCapability.js';

const recipes = {
  publicId: 'list_recipes',
  name: 'Recipes',
  properties: [{ id: 'ingredients', name: 'Ingredients', type: 'text' }],
  activeItems: [{ id: 'pasta', title: 'Pasta bake', propertyValues: [{ propertyId: 'ingredients', textValue: 'Pasta\nSauce' }] }]
};

const shopping = {
  publicId: 'list_shopping',
  name: 'Shopping',
  properties: [],
  activeItems: [{ id: 'sauce', title: 'Sauce', propertyValues: [] }]
};

describe('createMealPlanningCapability', () => {
  it('returns a read-only grounded plan from named Lists', async () => {
    const capability = createMealPlanningCapability({
      loadAddressableLists: async () => [
        { id: 'list_recipes', name: 'Recipes' },
        { id: 'list_shopping', name: 'Shopping' }
      ],
      loadList: async (_userId, publicId) => (publicId === 'list_recipes' ? recipes : shopping)
    });

    await expect(
      capability({
        userId: 'user_123',
        command: 'meals',
        messageText: '/meals Recipes | Shopping',
        receivedAt: 1,
        providerContext: { provider: 'telegram', providerUserId: 'telegram_user', providerChatId: 'telegram_chat' }
      })
    ).resolves.toEqual({
      kind: 'reply',
      text:
        'Weekly meal plan from Recipes:\n- Monday: Pasta bake\n- Tuesday: Pasta bake\n- Wednesday: Pasta bake\n- Thursday: Pasta bake\n- Friday: Pasta bake\n\nIngredients to add to Shopping:\n- Pasta'
    });
  });
});
