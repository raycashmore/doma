import { createFileRoute } from '@tanstack/react-router';

import { FIXTURE_MODE } from '@/config/runtime';

export const Route = createFileRoute('/_tabs/week')({
  ssr: !FIXTURE_MODE,
  component: () => null
});
