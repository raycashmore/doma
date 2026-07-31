import { BookOpen, CalendarDays } from 'lucide-react';
import { Link } from '@tanstack/react-router';

import { cn } from '@/lib/utils';

export function MealSectionTabs({ active = 'meals', className }: { active?: 'week' | 'meals'; className?: string }) {
  return (
    <div className={cn('flex w-full max-w-64 rounded-full bg-meal-sand p-1 text-xs font-semibold', className)}>
      <Link
        to="/week"
        aria-current={active === 'week' ? 'page' : undefined}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2',
          active === 'week' ? 'bg-warm-bg-card text-warm-accent-soft' : 'text-warm-text-secondary'
        )}
      >
        <CalendarDays aria-hidden="true" size={14} />
        Week
      </Link>
      <Link
        to="/recipes"
        aria-current={active === 'meals' ? 'page' : undefined}
        className={cn(
          'flex flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2',
          active === 'meals' ? 'bg-warm-bg-card text-warm-accent-soft' : 'text-warm-text-secondary'
        )}
      >
        <BookOpen aria-hidden="true" size={14} />
        Meals
      </Link>
    </div>
  );
}
