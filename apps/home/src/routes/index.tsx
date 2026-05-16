import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage
});

function HomePage() {
  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto py-12 text-center">
        <h2 className="text-3xl font-serif font-semibold text-neutral-900 mb-3">
          Welcome
        </h2>
        <p className="text-neutral-600">
          Highlights and summary widgets are coming soon. Use the sidebar to
          jump into an app.
        </p>
      </div>
    </div>
  );
}
