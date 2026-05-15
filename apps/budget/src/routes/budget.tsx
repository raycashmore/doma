import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from 'convex/react';
import { api } from '@repo/convex';
import BudgetChart from '@/components/budget/BudgetChart';

export const Route = createFileRoute('/budget')({
  component: BudgetPage
});

function BudgetPage() {
  const data = useQuery(api.queries.listBudgetChart);

  if (data === undefined) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-gray-400">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Budget</h1>
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <BudgetChart data={data} />
        </div>
      </div>
    </div>
  );
}
