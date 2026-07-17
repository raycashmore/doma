import { useState } from 'react';
import { LoaderCircle, Sparkles, X } from 'lucide-react';

import { MessageResponse } from '../ai-elements/MessageResponse';
import { DAY_NAMES, MEAL_NAMES } from './weeklyMealPlannerModel';
import type { WeeklyMealProposal } from './weeklyMealPlannerModel';

export function MealSuggestionDialog({
  proposal,
  requesting,
  applying,
  error,
  onRequest,
  onApply,
  onClose,
  recipeNames
}: {
  proposal: WeeklyMealProposal | null;
  requesting: boolean;
  applying: boolean;
  error: string;
  onRequest: (instruction?: string) => void;
  onApply: () => void;
  onClose: () => void;
  recipeNames: Map<string, string>;
}) {
  const [instruction, setInstruction] = useState('');
  const assignments = proposal?.outcome.kind === 'proposal' ? proposal.outcome.assignments : [];
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-warm-bg-dark/60 p-3 md:items-center"
      role="presentation"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Meal suggestions"
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-warm-bg-card p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-warm-display text-2xl text-warm-text-primary">Suggest meals</h2>
            <p className="mt-1 text-xs text-warm-text-secondary">
              Existing meals stay locked. Only empty slots can be filled.
            </p>
          </div>
          <button type="button" aria-label="Close meal suggestions" onClick={onClose} className="rounded-full p-2">
            <X aria-hidden="true" size={18} />
          </button>
        </div>

        {!proposal ? (
          <div className="mt-5 space-y-4">
            <label className="block text-sm font-semibold text-warm-text-primary">
              Optional instruction
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                maxLength={500}
                placeholder="For example: keep Friday especially quick"
                className="mt-2 min-h-24 w-full rounded-2xl border border-warm-border bg-warm-bg-card-soft p-3 font-normal"
              />
            </label>
            <button
              type="button"
              disabled={requesting}
              onClick={() => onRequest(instruction.trim() || undefined)}
              className="flex w-full items-center justify-center gap-2 rounded-full bg-warm-accent-soft px-4 py-3 text-sm font-bold text-warm-bg-card-soft disabled:opacity-60"
            >
              {requesting ? (
                <LoaderCircle aria-hidden="true" className="animate-spin" size={17} />
              ) : (
                <Sparkles aria-hidden="true" size={17} />
              )}
              {requesting ? 'Planning…' : 'Create suggestions'}
            </button>
          </div>
        ) : proposal.outcome.kind === 'cannotPropose' ? (
          <div className="mt-5 rounded-2xl bg-meal-sand p-4">
            <MessageResponse>{proposal.outcome.reason}</MessageResponse>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <ul className="space-y-3">
              {assignments.map((assignment) => (
                <li key={`${assignment.day}:${assignment.meal}`} className="rounded-2xl border border-warm-border p-3">
                  <p className="text-sm font-bold text-warm-text-primary">
                    {DAY_NAMES[assignment.day]} {MEAL_NAMES[assignment.meal]} ·{' '}
                    {recipeNames.get(assignment.recipePublicId) ?? 'Saved recipe'}
                  </p>
                  <MessageResponse>{assignment.reason}</MessageResponse>
                </li>
              ))}
            </ul>
            <button
              type="button"
              disabled={applying}
              onClick={onApply}
              className="w-full rounded-full bg-warm-accent-soft px-4 py-3 text-sm font-bold text-warm-bg-card-soft disabled:opacity-60"
            >
              {applying ? 'Filling slots…' : 'Fill empty slots'}
            </button>
          </div>
        )}
        {error ? (
          <p role="alert" className="mt-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
