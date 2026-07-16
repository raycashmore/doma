import { createFileRoute } from '@tanstack/react-router';
import { CalendarDays } from 'lucide-react';

import { MealSectionTabs } from '@/components/meals/MealSectionTabs';

export const Route = createFileRoute('/week')({ component: WeekRoute });

export function WeekRoute() {
  return (
    <section className="flex min-h-full flex-col gap-6 rounded-t-[24px] bg-warm-bg-card p-4 md:h-full md:rounded-[28px] md:p-6">
      <MealSectionTabs active="week" />
      <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-[20px] border border-dashed border-warm-border bg-warm-bg-card-soft p-8 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-meal-sage">
          <CalendarDays aria-hidden="true" size={22} />
        </span>
        <div>
          <h2 className="font-warm-display text-2xl">Weekly planning comes next</h2>
          <p className="mt-1 max-w-sm text-sm text-warm-text-secondary">
            This route is reserved while the cookbook foundation takes shape.
          </p>
        </div>
      </div>
    </section>
  );
}
