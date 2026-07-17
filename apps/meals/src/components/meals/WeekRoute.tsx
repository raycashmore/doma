import { useState } from 'react';
import { useAuth } from '@clerk/clerk-react';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@repo/convex';
import { getNextWeekStart, shiftWeekStart } from '@repo/convex/meals/model';

import { WeeklyMealPlanner } from './WeeklyMealPlanner';
import type { WeeklyMealAssignmentChange } from '@repo/convex/meals/model';

import type { WeeklyMealProposal } from './weeklyMealPlannerModel';
import { FIXTURE_MODE } from '@/config/runtime';
import { listFixtureRecipes } from '@/lib/fixtureRecipes';
import {
  applyFixtureWeeklyMealProposal,
  createFixtureWeeklyMealProposal,
  getFixtureWeeklyMealPlan,
  setFixtureWeeklyMealAssignment
} from '@/lib/fixtureWeeklyMealPlans';

export function WeekRoute() {
  const [weekStart, setWeekStart] = useState(() => getNextWeekStart(new Date()));
  const changeWeek = (weekDelta: number) => setWeekStart((current) => shiftWeekStart(current, weekDelta));

  if (FIXTURE_MODE) {
    return <FixtureWeekRoute key={weekStart} weekStart={weekStart} onWeekChange={changeWeek} />;
  }

  return <ConvexWeekRoute weekStart={weekStart} onWeekChange={changeWeek} />;
}

function FixtureWeekRoute({
  weekStart,
  onWeekChange
}: {
  weekStart: string;
  onWeekChange: (weekDelta: number) => void;
}) {
  const [plan, setPlan] = useState(() => getFixtureWeeklyMealPlan(weekStart));
  const handleAssignmentChange = (change: WeeklyMealAssignmentChange) => {
    setPlan(setFixtureWeeklyMealAssignment({ weekStart, ...change }));
  };

  return (
    <WeeklyMealPlanner
      recipes={listFixtureRecipes()}
      plan={plan}
      onWeekChange={onWeekChange}
      onAssignmentChange={handleAssignmentChange}
      onRequestSuggestions={(instruction) => Promise.resolve(createFixtureWeeklyMealProposal(weekStart, instruction))}
      onApplyProposal={(runId) => setPlan(applyFixtureWeeklyMealProposal(runId))}
    />
  );
}

function ConvexWeekRoute({
  weekStart,
  onWeekChange
}: {
  weekStart: string;
  onWeekChange: (weekDelta: number) => void;
}) {
  const recipes = useQuery(api.meals.queries.listRecipes, {});
  const plan = useQuery(api.meals.queries.getWeeklyMealPlan, { weekStart });
  const setAssignment = useMutation(api.meals.mutations.setWeeklyMealAssignmentMutation);
  const applyProposal = useMutation(api.meals.mutations.applyWeeklyMealProposal);
  const { getToken } = useAuth();

  if (recipes === undefined || plan === undefined) {
    return <WeeklyMealPlanLoading />;
  }

  return (
    <WeeklyMealPlanner
      recipes={recipes}
      plan={plan ?? { weekStart, assignments: [] }}
      onWeekChange={onWeekChange}
      onAssignmentChange={async (change) => {
        await setAssignment({ weekStart, ...change });
      }}
      onRequestSuggestions={async (instruction) => {
        const token = await getToken();
        if (!token) throw new Error('Not authenticated');
        const response = await fetch('/api/agent/weekly-meals', {
          method: 'POST',
          headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
          body: JSON.stringify({ weekStart, expectedPlanUpdatedAt: plan?.updatedAt ?? null, instruction })
        });
        if (!response.ok) throw new Error('Suggestions unavailable');
        return (await response.json()) as WeeklyMealProposal;
      }}
      onApplyProposal={async (runId) => {
        await applyProposal({ runId });
      }}
    />
  );
}

export function WeeklyMealPlanLoading() {
  return (
    <section aria-label="Loading weekly meal plan" className="h-full animate-pulse rounded-[28px] bg-warm-bg-card p-6">
      <p className="font-warm-display text-2xl text-warm-text-primary">Loading week plan…</p>
      <div className="mt-5 grid h-[calc(100%_-_3rem)] grid-cols-2 gap-3 md:grid-cols-5" aria-hidden="true">
        {Array.from({ length: 10 }, (_, index) => (
          <span key={index} className="rounded-[16px] border border-warm-border bg-warm-bg-card-soft" />
        ))}
      </div>
    </section>
  );
}
