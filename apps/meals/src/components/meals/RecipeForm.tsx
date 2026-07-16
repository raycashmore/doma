import { useState } from 'react';
import { Check, MoveDown, MoveUp, Plus, Trash2 } from 'lucide-react';

import { MealSectionTabs } from './MealSectionTabs';
import { mealHref } from './links';
import type { FormEvent } from 'react';
import type { RecipeFormValue } from './types';
import { cn } from '@/lib/utils';

const SUITABILITY_OPTIONS = ['Dinner', 'School lunch', 'Quick', 'Favourite'] as const;
const EMPTY_VALUE: RecipeFormValue = {
  name: '',
  description: '',
  preparationTime: '',
  servingsLabel: '',
  mealSuitabilityTags: [],
  ingredientLines: [''],
  instructions: ''
};

type IngredientRow = { id: number; value: string };
let nextIngredientRowId = 0;

function createIngredientRows(lines: Array<string>): Array<IngredientRow> {
  return (lines.length ? lines : ['']).map((line) => ({ id: nextIngredientRowId++, value: line }));
}

type RecipeFormProps = {
  mode: 'create' | 'edit';
  initialValue?: RecipeFormValue;
  submitting?: boolean;
  submitError?: string;
  cancelHref?: string;
  baseUrl?: string;
  onSubmit: (value: RecipeFormValue) => void | Promise<void>;
};

export function RecipeForm({
  mode,
  initialValue = EMPTY_VALUE,
  submitting = false,
  submitError,
  cancelHref,
  baseUrl = '/meals/',
  onSubmit
}: RecipeFormProps) {
  const [value, setValue] = useState<RecipeFormValue>(() => ({
    ...initialValue,
    mealSuitabilityTags: [...initialValue.mealSuitabilityTags],
    ingredientLines: []
  }));
  const [ingredientRows, setIngredientRows] = useState(() => createIngredientRows(initialValue.ingredientLines));
  const [validationError, setValidationError] = useState('');

  function updateIngredient(index: number, ingredient: string) {
    setIngredientRows((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, value: ingredient } : row))
    );
  }

  function moveIngredient(index: number, offset: -1 | 1) {
    setIngredientRows((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.length) return current;
      const reordered = [...current];
      const [row] = reordered.splice(index, 1);
      reordered.splice(destination, 0, row);
      return reordered;
    });
  }

  function toggleTag(tag: string) {
    setValue((current) => ({
      ...current,
      mealSuitabilityTags: current.mealSuitabilityTags.includes(tag)
        ? current.mealSuitabilityTags.filter((item) => item !== tag)
        : [...current.mealSuitabilityTags, tag]
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = {
      ...value,
      name: value.name.trim(),
      description: value.description.trim(),
      preparationTime: value.preparationTime.trim(),
      servingsLabel: value.servingsLabel.trim(),
      ingredientLines: ingredientRows.map((row) => row.value.trim()).filter(Boolean),
      instructions: value.instructions.trim()
    };
    if (!normalized.name || !normalized.ingredientLines.length || !normalized.instructions) {
      setValidationError('Add a meal name, at least one ingredient, and instructions.');
      return;
    }
    setValidationError('');
    void onSubmit(normalized);
  }

  const fieldClass =
    'mt-1.5 w-full rounded-[11px] border border-warm-border bg-warm-bg-card-soft px-3 py-2.5 text-sm outline-none focus:border-warm-accent-soft';

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-full flex-col gap-4 rounded-t-[24px] bg-warm-bg-card p-4 pb-24 md:h-full md:min-h-0 md:rounded-[28px] md:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <MealSectionTabs baseUrl={baseUrl} />
        <div className="hidden items-center gap-2 md:flex">
          <a
            href={cancelHref ?? mealHref(baseUrl)}
            className="rounded-full px-3.5 py-2 text-xs font-semibold text-warm-text-secondary"
          >
            Cancel
          </a>
          <button
            type="submit"
            disabled={submitting}
            className="flex items-center gap-1.5 rounded-full bg-warm-text-primary px-4 py-2.5 text-xs font-bold text-warm-bg-card-soft disabled:opacity-60"
          >
            <Check aria-hidden="true" size={14} /> {submitting ? 'Saving…' : 'Save meal'}
          </button>
        </div>
      </div>

      <div>
        <h2 className="font-warm-display text-2xl md:text-[28px]">
          {mode === 'edit' ? `Edit ${initialValue.name}` : 'Add a meal'}
        </h2>
        <p className="mt-1 text-xs text-warm-text-secondary">
          Keep the details practical so household favourites are easy to find and cook.
        </p>
      </div>

      {validationError || submitError ? (
        <p role="alert" className="rounded-xl bg-meal-peach px-3 py-2 text-xs text-warm-accent">
          {validationError || submitError}
        </p>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 md:grid-cols-[minmax(280px,430px)_minmax(0,1fr)]">
        <div className="space-y-4 rounded-[18px] border border-warm-border bg-warm-bg-card-soft p-4 md:overflow-y-auto md:p-[18px]">
          <label className="block text-[11px] font-bold text-warm-text-secondary">
            Meal name
            <input
              aria-label="Meal name"
              value={value.name}
              onChange={(event) => setValue({ ...value, name: event.target.value })}
              className={fieldClass}
            />
          </label>
          <label className="block text-[11px] font-bold text-warm-text-secondary">
            Short description
            <textarea
              aria-label="Short description"
              rows={2}
              value={value.description}
              onChange={(event) => setValue({ ...value, description: event.target.value })}
              className={fieldClass}
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-[11px] font-bold text-warm-text-secondary">
              Prep time
              <input
                aria-label="Prep time"
                value={value.preparationTime}
                onChange={(event) => setValue({ ...value, preparationTime: event.target.value })}
                className={fieldClass}
              />
            </label>
            <label className="block text-[11px] font-bold text-warm-text-secondary">
              Servings
              <input
                aria-label="Servings"
                value={value.servingsLabel}
                onChange={(event) => setValue({ ...value, servingsLabel: event.target.value })}
                className={fieldClass}
              />
            </label>
          </div>
          <fieldset>
            <legend className="text-[11px] font-bold text-warm-text-secondary">Meal suitability</legend>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUITABILITY_OPTIONS.map((tag) => {
                const selected = value.mealSuitabilityTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleTag(tag)}
                    className={cn(
                      'flex items-center gap-1 rounded-full border px-2.5 py-1.5 text-[10px] font-semibold',
                      selected ? 'border-transparent bg-meal-sage' : 'border-warm-border bg-warm-bg-card'
                    )}
                  >
                    {selected ? <Check aria-hidden="true" size={11} /> : null}
                    {tag}
                  </button>
                );
              })}
            </div>
          </fieldset>
        </div>

        <div className="flex min-h-0 flex-col gap-4 md:overflow-y-auto">
          <section className="rounded-[18px] border border-warm-border bg-warm-bg-card-soft p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-warm-display text-xl">Ingredients</h3>
                <p className="text-[10px] text-warm-text-secondary">Keep quantities as display text.</p>
              </div>
              <button
                type="button"
                aria-label="Add ingredient line"
                onClick={() => setIngredientRows((current) => [...current, { id: nextIngredientRowId++, value: '' }])}
                className="flex items-center gap-1 text-[10px] font-bold text-warm-accent-soft"
              >
                <Plus aria-hidden="true" size={13} /> Add line
              </button>
            </div>
            <div className="mt-3 divide-y divide-warm-border rounded-xl border border-warm-border bg-warm-bg-card">
              {ingredientRows.map((row, index) => (
                <div key={row.id} className="flex items-center gap-1 px-2.5">
                  <div className="flex shrink-0">
                    <button
                      type="button"
                      aria-label={`Move ingredient ${index + 1} up`}
                      disabled={index === 0}
                      onClick={() => moveIngredient(index, -1)}
                      className="p-1 text-warm-text-tertiary disabled:opacity-25"
                    >
                      <MoveUp aria-hidden="true" size={12} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ingredient ${index + 1} down`}
                      disabled={index === ingredientRows.length - 1}
                      onClick={() => moveIngredient(index, 1)}
                      className="p-1 text-warm-text-tertiary disabled:opacity-25"
                    >
                      <MoveDown aria-hidden="true" size={12} />
                    </button>
                  </div>
                  <input
                    aria-label={`Ingredient ${index + 1}`}
                    value={row.value}
                    onChange={(event) => updateIngredient(index, event.target.value)}
                    placeholder="e.g. 4 chicken thighs"
                    className="min-w-0 flex-1 bg-transparent py-2.5 text-sm outline-none"
                  />
                  {ingredientRows.length > 1 ? (
                    <button
                      type="button"
                      aria-label={`Remove ingredient ${index + 1}`}
                      onClick={() =>
                        setIngredientRows((current) => current.filter((_, rowIndex) => rowIndex !== index))
                      }
                      className="text-warm-text-tertiary hover:text-warm-accent"
                    >
                      <Trash2 aria-hidden="true" size={14} />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          </section>

          <label className="flex min-h-40 flex-1 flex-col rounded-[18px] border border-warm-border bg-warm-bg-card-soft p-4 text-[11px] font-bold text-warm-text-secondary">
            Instructions
            <textarea
              aria-label="Instructions"
              value={value.instructions}
              onChange={(event) => setValue({ ...value, instructions: event.target.value })}
              className="mt-2 min-h-32 flex-1 resize-none rounded-xl border border-warm-border bg-warm-bg-card p-3 text-sm font-normal leading-6 text-warm-text-primary outline-none focus:border-warm-accent-soft"
            />
          </label>
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="fixed right-4 bottom-[76px] left-4 z-20 flex items-center justify-center gap-1.5 rounded-full bg-warm-text-primary px-4 py-3 text-xs font-bold text-warm-bg-card-soft shadow-lg disabled:opacity-60 md:hidden"
      >
        <Check aria-hidden="true" size={14} /> {submitting ? 'Saving…' : 'Save meal'}
      </button>
    </form>
  );
}
