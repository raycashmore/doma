import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter
} from '@tanstack/react-router';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { WeekRoute, WeeklyMealPlanLoading } from '@/components/meals/WeekRoute';
import { WeeklyMealPlanner } from '@/components/meals/WeeklyMealPlanner';
import { listFixtureRecipes } from '@/lib/fixtureRecipes';

vi.mock('@/config/runtime', () => ({ FIXTURE_MODE: true }));

function createWeekRouter() {
  const rootRoute = createRootRoute();
  const weekRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/week',
    component: WeekRoute
  });
  return createRouter({
    routeTree: rootRoute.addChildren([weekRoute]),
    history: createMemoryHistory({ initialEntries: ['/week'] })
  });
}

async function renderWeek() {
  const router = createWeekRouter();
  await router.load();
  render(<RouterProvider router={router} />);
}

function stubMobileViewport() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: !query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-07-16T09:00:00.000Z'));
  vi.stubGlobal('scrollTo', vi.fn());
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: query.includes('min-width'),
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn()
  }));
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('WeekRoute', () => {
  it('shows the Monday-to-Friday meal plan and exact ingredient-line shopping review', async () => {
    await renderWeek();

    expect(screen.getByRole('heading', { name: 'Week plan' })).toBeDefined();
    expect(screen.getByText('Mon 20 Jul – Fri 24 Jul')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Suggest meals' })).toBeDefined();

    const desktopPlanner = screen.getByLabelText('Weekly meal plan');
    for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
      expect(within(desktopPlanner).getByText(day)).toBeDefined();
    }
    expect(within(desktopPlanner).getByRole('button', { name: 'Change Monday school lunch' }).textContent).toContain(
      'Veggie wraps'
    );

    const shoppingReview = screen.getByLabelText('Shopping review');
    expect(within(shoppingReview).getByText('4 wraps')).toBeDefined();
    expect(within(shoppingReview).getByText('1 cucumber')).toBeDefined();
  });

  it('offers suggestions only for weeks covered by the schedule planning horizon', async () => {
    await renderWeek();
    expect(screen.getByRole('button', { name: 'Suggest meals' })).toBeDefined();

    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));

    expect(screen.queryByRole('button', { name: 'Suggest meals' })).toBeNull();
  });

  it('selects a weekday on mobile and lets the user replace a saved assignment', async () => {
    stubMobileViewport();
    await renderWeek();

    fireEvent.click(screen.getByRole('button', { name: 'Select Tuesday 21 July' }));
    const mobileDay = screen.getByLabelText('Selected day meals');
    expect(within(mobileDay).getByText('Tuesday')).toBeDefined();
    const nextDayPreview = screen.getByRole('button', { name: 'Preview Wednesday' });
    expect(nextDayPreview.textContent).toContain('Rice bowls');
    expect(nextDayPreview.textContent).toContain('Bean quesadillas');

    fireEvent.click(within(mobileDay).getByRole('button', { name: 'Change Tuesday dinner' }));
    const chooser = screen.getByRole('dialog', { name: 'Choose Tuesday dinner' });
    await act(async () => {
      fireEvent.click(within(chooser).getByRole('button', { name: 'Chicken tray bake' }));
      await Promise.resolve();
    });

    expect(within(mobileDay).getByRole('button', { name: 'Change Tuesday dinner' }).textContent).toContain(
      'Chicken tray bake'
    );

    cleanup();
    await renderWeek();
    fireEvent.click(screen.getByRole('button', { name: 'Select Tuesday 21 July' }));
    const restoredDay = screen.getByLabelText('Selected day meals');
    expect(within(restoredDay).getByRole('button', { name: 'Change Tuesday dinner' }).textContent).toContain(
      'Chicken tray bake'
    );

    fireEvent.click(within(restoredDay).getByRole('button', { name: 'Change Tuesday dinner' }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Clear this slot' }));
      await Promise.resolve();
    });
    expect(within(restoredDay).getByRole('button', { name: 'Choose Tuesday dinner' })).toBeDefined();

    cleanup();
    await renderWeek();
    fireEvent.click(screen.getByRole('button', { name: 'Select Tuesday 21 July' }));
    expect(
      within(screen.getByLabelText('Selected day meals')).getByRole('button', { name: 'Choose Tuesday dinner' })
    ).toBeDefined();
  });

  it('keeps the chooser open and explains when an assignment cannot be saved', async () => {
    stubMobileViewport();
    const onAssignmentChange = vi.fn().mockRejectedValue(new Error('offline'));
    const rootRoute = createRootRoute();
    const plannerRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/week',
      component: () => (
        <WeeklyMealPlanner
          recipes={listFixtureRecipes()}
          plan={{ weekStart: '2026-07-20', assignments: [] }}
          onWeekChange={vi.fn()}
          onAssignmentChange={onAssignmentChange}
        />
      )
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([plannerRoute]),
      history: createMemoryHistory({ initialEntries: ['/week'] })
    });
    await router.load();
    render(<RouterProvider router={router} />);

    const slot = screen.getByRole('button', { name: 'Choose Monday dinner' });
    slot.focus();
    fireEvent.click(slot);
    const chooser = screen.getByRole('dialog', { name: 'Choose Monday dinner' });
    expect(document.activeElement).toBe(within(chooser).getByRole('button', { name: 'Close meal chooser' }));

    await act(async () => {
      fireEvent.click(within(chooser).getByRole('button', { name: 'Pasta bake' }));
      await Promise.resolve();
    });
    const failedChooser = screen.getByRole('dialog', { name: 'Choose Monday dinner' });
    expect(within(failedChooser).getByRole('alert').textContent).toContain(
      'Meal assignment could not be saved. Try again.'
    );

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Choose Monday dinner' })).toBeNull();
    expect(document.activeElement).toBe(slot);
  });

  it('keeps keyboard focus contained while an assignment save is pending', async () => {
    stubMobileViewport();
    let finishSave: () => void = vi.fn();
    const pendingSave = new Promise<void>((resolve) => {
      finishSave = resolve;
    });
    const rootRoute = createRootRoute();
    const plannerRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/week',
      component: () => (
        <WeeklyMealPlanner
          recipes={listFixtureRecipes()}
          plan={{ weekStart: '2026-07-20', assignments: [] }}
          onWeekChange={vi.fn()}
          onAssignmentChange={() => pendingSave}
        />
      )
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([plannerRoute]),
      history: createMemoryHistory({ initialEntries: ['/week'] })
    });
    await router.load();
    render(<RouterProvider router={router} />);

    const slot = screen.getByRole('button', { name: 'Choose Monday dinner' });
    slot.focus();
    fireEvent.click(slot);
    const chooser = screen.getByRole('dialog', { name: 'Choose Monday dinner' });
    fireEvent.click(within(chooser).getByRole('button', { name: 'Pasta bake' }));
    await act(async () => Promise.resolve());

    const closeButton = within(chooser).getByRole('button', { name: 'Close meal chooser' });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(document.activeElement).toBe(closeButton);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Choose Monday dinner' })).toBeNull();
    expect(document.activeElement).toBe(slot);

    fireEvent.click(screen.getByRole('button', { name: 'Choose Monday school lunch' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    await act(async () => {
      finishSave();
      await pendingSave;
    });

    fireEvent.click(screen.getByRole('button', { name: 'Choose Monday school lunch' }));
    expect(screen.getByRole('dialog', { name: 'Choose Monday school lunch' })).toBeDefined();
  });

  it('shows clear loading and empty-week states', async () => {
    render(<WeeklyMealPlanLoading />);
    expect(screen.getByText('Loading week plan…')).toBeDefined();
    cleanup();

    await renderWeek();
    fireEvent.click(screen.getByRole('button', { name: 'Next week' }));

    expect(screen.getByText('Mon 27 Jul – Fri 31 Jul')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Choose Monday school lunch' })).toBeDefined();
    expect(screen.getByText('Assign meals to build a shopping review.')).toBeDefined();
  });

  it('removes a shopping draft row without changing its source recipe', async () => {
    await renderWeek();

    const shoppingReview = screen.getByLabelText('Shopping review');
    fireEvent.click(within(shoppingReview).getByRole('button', { name: 'Remove 4 wraps' }));

    expect(within(shoppingReview).queryByText('4 wraps')).toBeNull();
    expect(screen.getByRole('button', { name: 'Change Monday school lunch' }).textContent).toContain('Veggie wraps');
  });

  it('reviews and applies agent suggestions only to empty slots while keeping Lists explicit', async () => {
    await renderWeek();

    fireEvent.click(screen.getByRole('button', { name: 'Suggest meals' }));
    const dialog = screen.getByRole('dialog', { name: 'Meal suggestions' });
    fireEvent.change(within(dialog).getByLabelText('Optional instruction'), { target: { value: 'Keep Friday quick' } });
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Create suggestions' }));
      await Promise.resolve();
    });
    expect(within(dialog).getByText(/Friday dinner/).textContent).toContain('Chicken tray bake');
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Fill empty slots' }));
      await Promise.resolve();
    });
    expect(screen.queryByRole('dialog', { name: 'Meal suggestions' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Change Friday dinner' }).textContent).toContain('Chicken tray bake');
    expect(screen.getByRole('button', { name: 'Change Monday dinner' }).textContent).toContain('Chicken tray bake');

    fireEvent.click(screen.getByRole('button', { name: 'Send to Lists' }));
    expect(screen.getByRole('status').textContent).toContain(
      'Review and approval for Lists will be added with the agent integration.'
    );
  });

  it('closes the mobile cart before explaining the unavailable Lists handoff', async () => {
    stubMobileViewport();
    await renderWeek();

    fireEvent.click(screen.getByRole('button', { name: 'Review' }));
    const shoppingReview = screen.getByLabelText('Shopping review');
    fireEvent.click(within(shoppingReview).getByRole('button', { name: 'Send to Lists' }));

    expect(screen.queryByLabelText('Shopping review')).toBeNull();
    expect(screen.getByRole('status').textContent).toContain(
      'Review and approval for Lists will be added with the agent integration.'
    );
  });
});
