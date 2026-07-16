import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

import { DAY_NAMES, MEAL_NAMES } from './weeklyMealPlannerModel';
import type { SlotSelection } from './weeklyMealPlannerModel';

import type { RecipeView } from './types';

type RecipeChooserProps = {
  selection: SlotSelection;
  recipes: Array<RecipeView>;
  onSelect: (recipePublicId: string | null) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  error: string;
};

export function RecipeChooser({ selection, recipes, onSelect, onClose, saving, error }: RecipeChooserProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const title = `Choose ${DAY_NAMES[selection.day]} ${MEAL_NAMES[selection.meal]}`;
  const preferredTag = selection.meal === 'schoolLunch' ? 'School lunch' : 'Dinner';
  const sortedRecipes = [...recipes].sort(
    (left, right) =>
      Number(right.mealSuitabilityTags.includes(preferredTag)) - Number(left.mealSuitabilityTags.includes(preferredTag))
  );

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const focusable = () =>
      Array.from(
        dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [href], [tabindex]:not([tabindex="-1"])')
      );
    focusable()[0]?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;

      const controls = focusable();
      if (controls.length === 0) return;
      const first = controls[0];
      const last = controls[controls.length - 1];
      const activeControl = document.activeElement;
      if (!(activeControl instanceof HTMLElement) || !controls.includes(activeControl)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);

  useEffect(() => {
    if (saving) closeButtonRef.current?.focus();
  }, [saving]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-warm-bg-dark/60 p-3 md:items-center"
      onMouseDown={onClose}
    >
      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="max-h-[78vh] w-full max-w-lg overflow-hidden rounded-[24px] border border-warm-border bg-warm-bg-card-soft p-4 shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wide text-warm-accent-soft">Meal slot</p>
            <h3 className="font-warm-display text-xl">{title}</h3>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label="Close meal chooser"
            onClick={onClose}
            className="rounded-full bg-meal-sand p-2"
          >
            <X aria-hidden="true" size={16} />
          </button>
        </div>
        {error ? (
          <p role="alert" className="mt-3 rounded-[12px] bg-meal-peach px-3 py-2 text-xs text-warm-text-primary">
            {error}
          </p>
        ) : null}
        <div className="mt-4 grid max-h-[55vh] gap-2 overflow-y-auto sm:grid-cols-2">
          {sortedRecipes.map((recipe) => (
            <button
              key={recipe.publicId}
              type="button"
              aria-label={recipe.name}
              onClick={() => void onSelect(recipe.publicId)}
              disabled={saving}
              className="rounded-[14px] border border-warm-border bg-warm-bg-card p-3 text-left hover:border-warm-accent-soft"
            >
              <span className="block font-warm-display text-base">{recipe.name}</span>
              <span className="mt-1 block truncate text-[10px] text-warm-text-secondary">
                {recipe.mealSuitabilityTags.join(' · ') || recipe.description}
              </span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void onSelect(null)}
          disabled={saving}
          className="mt-3 w-full rounded-full border border-warm-border px-4 py-2.5 text-xs font-semibold text-warm-text-secondary"
        >
          {saving ? 'Saving…' : 'Clear this slot'}
        </button>
      </section>
    </div>
  );
}
