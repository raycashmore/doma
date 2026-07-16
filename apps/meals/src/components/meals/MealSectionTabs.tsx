import { BookOpen, CalendarDays } from 'lucide-react';

import { mealHref } from './links';
import { cn } from '@/lib/utils';

export function MealSectionTabs({
  baseUrl = '/meals/',
  active = 'meals'
}: {
  baseUrl?: string;
  active?: 'week' | 'meals';
}) {
  return (
    <div className="flex w-full max-w-64 rounded-full bg-meal-sand p-1 text-xs font-semibold">
      <a
        href={mealHref(baseUrl, 'week')}
        aria-current={active === 'week' ? 'page' : undefined}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2',
          active === 'week' ? 'bg-warm-bg-card text-warm-accent-soft' : 'text-warm-text-secondary'
        )}
      >
        <CalendarDays aria-hidden="true" size={14} />
        Week
      </a>
      <a
        href={mealHref(baseUrl)}
        aria-current={active === 'meals' ? 'page' : undefined}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2',
          active === 'meals' ? 'bg-warm-bg-card text-warm-accent-soft' : 'text-warm-text-secondary'
        )}
      >
        <BookOpen aria-hidden="true" size={14} />
        Meals
      </a>
    </div>
  );
}
