import { useEffect, useState } from 'react';
import { getWeekDates } from '@repo/convex/meals/model';

import { DesktopWeeklyMealPlan } from './DesktopWeeklyMealPlan';
import { MobileWeeklyMealPlan } from './MobileWeeklyMealPlan';
import { RecipeChooser } from './RecipeChooser';
import { ShoppingReview } from './ShoppingReview';
import { WeeklyMealPlannerTabs } from './WeeklyMealPlannerHeader';
import { useDesktopViewport } from './useDesktopViewport';
import type { ShoppingRow, SlotSelection, WeeklyMealPlannerProps } from './weeklyMealPlannerModel';
import type { Weekday, WeeklyMealType } from '@repo/convex/meals/model';

export function WeeklyMealPlanner({ recipes, plan, onWeekChange, onAssignmentChange }: WeeklyMealPlannerProps) {
  const isDesktop = useDesktopViewport();
  const dates = getWeekDates(plan.weekStart);
  const [selectedDay, setSelectedDay] = useState<Weekday>('monday');
  const [chooser, setChooser] = useState<SlotSelection | null>(null);
  const [removedRows, setRemovedRows] = useState<Set<string>>(() => new Set());
  const [cartOpen, setCartOpen] = useState(false);
  const [status, setStatus] = useState('');
  const [assignmentSaving, setAssignmentSaving] = useState(false);
  const [assignmentError, setAssignmentError] = useState('');
  const recipesById = new Map(recipes.map((recipe) => [recipe.publicId, recipe]));

  useEffect(() => {
    setSelectedDay('monday');
    setRemovedRows(new Set());
    setCartOpen(false);
  }, [plan.weekStart]);

  const shoppingRows = plan.assignments
    .flatMap<ShoppingRow>((assignment) => {
      const recipe = recipesById.get(assignment.recipePublicId);
      if (!recipe) return [];
      return recipe.ingredientLines.map((line, index) => ({
        id: `${assignment.day}-${assignment.meal}-${assignment.recipePublicId}-${index}`,
        line,
        recipeName: recipe.name
      }));
    })
    .filter((row) => !removedRows.has(row.id));

  const chooseSlot = (day: Weekday, meal: WeeklyMealType) => {
    if (assignmentSaving) return;
    setAssignmentError('');
    setChooser({ day, meal });
  };
  const selectRecipe = async (recipePublicId: string | null) => {
    if (!chooser || assignmentSaving) return;
    setAssignmentSaving(true);
    setAssignmentError('');
    try {
      await onAssignmentChange({ ...chooser, recipePublicId });
      setChooser(null);
      setRemovedRows(new Set());
    } catch {
      setAssignmentError('Meal assignment could not be saved. Try again.');
    } finally {
      setAssignmentSaving(false);
    }
  };
  const showFutureStatus = (kind: 'suggest' | 'lists') =>
    setStatus(
      kind === 'suggest'
        ? 'Meal suggestions will be available when the planning agent is connected.'
        : 'Review and approval for Lists will be added with the agent integration.'
    );
  const sendToLists = () => {
    setCartOpen(false);
    showFutureStatus('lists');
  };
  const removeShoppingRow = (id: string) => setRemovedRows((current) => new Set(current).add(id));

  return (
    <section className="flex min-h-full flex-col gap-4 rounded-t-[24px] bg-warm-bg-card p-4 md:h-full md:min-h-0 md:rounded-[28px] md:p-6">
      <WeeklyMealPlannerTabs isDesktop={isDesktop} onSuggest={() => showFutureStatus('suggest')} />

      {status ? (
        <p
          role="status"
          className="rounded-full bg-meal-sand px-3 py-2 text-center text-[10px] text-warm-text-secondary"
        >
          {status}
        </p>
      ) : null}

      {isDesktop ? (
        <DesktopWeeklyMealPlan
          assignments={plan.assignments}
          dates={dates}
          recipesById={recipesById}
          shoppingRows={shoppingRows}
          onChooseSlot={chooseSlot}
          onRemoveShoppingRow={removeShoppingRow}
          onSendToLists={sendToLists}
          onSuggest={() => showFutureStatus('suggest')}
          onWeekChange={onWeekChange}
        />
      ) : (
        <MobileWeeklyMealPlan
          assignments={plan.assignments}
          dates={dates}
          recipesById={recipesById}
          selectedDay={selectedDay}
          shoppingRowCount={shoppingRows.length}
          onChooseSlot={chooseSlot}
          onOpenCart={() => setCartOpen(true)}
          onSelectDay={setSelectedDay}
          onSuggest={() => showFutureStatus('suggest')}
          onWeekChange={onWeekChange}
        />
      )}

      {chooser ? (
        <RecipeChooser
          selection={chooser}
          recipes={recipes}
          onSelect={selectRecipe}
          onClose={() => {
            setChooser(null);
            setAssignmentError('');
          }}
          saving={assignmentSaving}
          error={assignmentError}
        />
      ) : null}
      {cartOpen ? (
        <>
          <button
            type="button"
            aria-label="Close shopping review"
            onClick={() => setCartOpen(false)}
            className="fixed inset-0 z-40 bg-warm-bg-dark/60"
          />
          <ShoppingReview
            rows={shoppingRows}
            onRemove={removeShoppingRow}
            onSend={sendToLists}
            onClose={() => setCartOpen(false)}
          />
        </>
      ) : null}
    </section>
  );
}
