import { describe, expect, it } from 'vitest';

import { createMealPlanningCapability } from './mealPlanningCapability.js';

const recipes = {
  publicId: 'list_recipes',
  name: 'Recipes',
  properties: [
    { id: 'ingredients', name: 'Ingredients', type: 'text' },
    {
      id: 'meal_type',
      name: 'Meal type',
      type: 'select',
      options: [
        { id: 'dinner_leftovers', label: 'Dinner with leftovers' },
        { id: 'lunch', label: 'Lunch' }
      ]
    }
  ],
  activeItems: [
    {
      id: 'pasta',
      title: 'Pasta bake',
      propertyValues: [
        { propertyId: 'ingredients', textValue: 'Pasta\nSauce' },
        { propertyId: 'meal_type', selectOptionId: 'dinner_leftovers' }
      ]
    },
    {
      id: 'lunch',
      title: 'Lunch box',
      propertyValues: [
        { propertyId: 'ingredients', textValue: 'Bread\nFruit' },
        { propertyId: 'meal_type', selectOptionId: 'lunch' }
      ]
    }
  ]
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
      text: 'Weekly meal plan from Recipes:\n- Monday: Dinner — Pasta bake; Lunch — Lunch box\n- Tuesday: Dinner — Pasta bake; Lunch — leftovers from Pasta bake\n- Wednesday: Dinner — Pasta bake; Lunch — leftovers from Pasta bake\n- Thursday: Dinner — Pasta bake; Lunch — leftovers from Pasta bake\n- Friday: Dinner — Pasta bake; Lunch — leftovers from Pasta bake\n\nIngredients to add to Shopping:\n- Pasta\n- Bread\n- Fruit'
    });
  });

  it('treats an avoid constraint as a hard eligibility rule', async () => {
    const capability = createMealPlanningCapability({
      loadAddressableLists: async () => [
        { id: 'list_recipes', name: 'Recipes' },
        { id: 'list_shopping', name: 'Shopping' }
      ],
      loadList: async (_userId, publicId) => {
        if (publicId !== 'list_recipes') return shopping;
        return {
          ...recipes,
          activeItems: [
            ...recipes.activeItems,
            {
              id: 'beans',
              title: 'Bean dinner',
              propertyValues: [
                { propertyId: 'ingredients', textValue: 'Beans\nRice' },
                { propertyId: 'meal_type', selectOptionId: 'dinner' }
              ]
            }
          ],
          properties: [
            ...recipes.properties.slice(0, 1),
            {
              ...recipes.properties[1]!,
              options: [...recipes.properties[1]!.options!, { id: 'dinner', label: 'Dinner' }]
            }
          ]
        };
      }
    });

    const result = await capability({
      userId: 'user_123',
      command: 'meals',
      messageText: '/meals Recipes | Shopping | avoid: Sauce',
      receivedAt: 1,
      providerContext: { provider: 'telegram', providerUserId: 'telegram_user', providerChatId: 'telegram_chat' }
    });

    expect(result).toEqual({
      kind: 'reply',
      text: 'Weekly meal plan from Recipes:\n- Monday: Dinner — Bean dinner; Lunch — Lunch box\n- Tuesday: Dinner — Bean dinner; Lunch — Lunch box\n- Wednesday: Dinner — Bean dinner; Lunch — Lunch box\n- Thursday: Dinner — Bean dinner; Lunch — Lunch box\n- Friday: Dinner — Bean dinner; Lunch — Lunch box\n\nIngredients to add to Shopping:\n- Bread\n- Fruit\n- Beans\n- Rice'
    });
  });

  it('asks for a different list name when a name is ambiguous', async () => {
    const capability = createMealPlanningCapability({
      loadAddressableLists: async () => [
        { id: 'list_recipes_a', name: 'Recipes' },
        { id: 'list_recipes_b', name: 'recipes' },
        { id: 'list_shopping', name: 'Shopping' }
      ],
      loadList: async (_userId, publicId) => (publicId === 'list_shopping' ? shopping : recipes)
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
      text: 'I found more than one list named Recipes. Please rename one or use a unique list name.'
    });
  });
});
