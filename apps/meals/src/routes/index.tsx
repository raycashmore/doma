import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: MealsRoutePlaceholder
});

function MealsRoutePlaceholder() {
  return null;
}
