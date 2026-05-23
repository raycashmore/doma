import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage
});

function HomePage() {
  return (
    <div className="p-6">
      <div className="max-w-3xl mx-auto py-12 text-center">
        <h2 className="mb-3 text-3xl font-warm-display text-warm-text-on-dark">
          Welcome
        </h2>
        <p className="text-warm-text-tertiary">
          Highlights and summary widgets are coming soon. Use the sidebar to
          jump into an app.
        </p>
      </div>
    </div>
  );
}
