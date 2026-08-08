import { createFileRoute } from '@tanstack/react-router';

import { MealsTabsLayout } from '@/components/meals/MealsTabsLayout';

export const Route = createFileRoute('/_tabs')({ component: MealsTabsLayout });
