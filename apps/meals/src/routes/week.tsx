import { createFileRoute } from '@tanstack/react-router';

import { WeekRoute } from '@/components/meals/WeekRoute';
import { FIXTURE_MODE } from '@/config/runtime';

export const Route = createFileRoute('/week')({
  ssr: !FIXTURE_MODE,
  component: WeekRoute
});
