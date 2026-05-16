import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@repo/convex';
import BudgetChart from '@/components/budget/BudgetChart';

export const Route = createFileRoute('/')({
  component: BudgetPage
});

function BudgetPage() {
  const data = useQuery(api.queries.listBudgetChart);

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-neutral-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-7xl mx-auto">
        <div className="bg-white rounded-lg border border-neutral-200 p-6">
          <BudgetChart data={data} />
        </div>
      </div>
    </div>
  );
}
