import { cleanup, render, screen, within } from '@testing-library/vue';
import { afterEach, describe, expect, it } from 'vitest';

import { homeUrlBuilderKey } from '../config/navigation';
import ActiveBoard from './ActiveBoard.vue';

afterEach(cleanup);

const completeBoard = {
  localDate: '2026-07-14',
  timeZone: 'Australia/Sydney',
  items: [
    {
      kind: 'today' as const,
      id: 'today:2026-07-14',
      destination: '/schedule',
      briefingStatus: 'available' as const,
      headline: 'Tuesday ready',
      generatedAt: Date.parse('2026-07-13T21:35:00.000Z'),
      morning: [{ text: 'Bring library bag', who: ['memberA'], sourceIds: ['requirements:bag:1'] }],
      laterToday: [
        {
          id: 'requirements-calendar:sport-kit:1',
          title: 'Bring sports bag',
          detail: 'Pack it before leaving.',
          start: Date.parse('2026-07-13T23:30:00.000Z'),
          end: Date.parse('2026-07-14T00:00:00.000Z'),
          allDay: false,
          who: ['memberB'],
          destination: 'https://calendar.example.test/event/sport-kit'
        }
      ],
      watchouts: [{ text: 'Signed form due tomorrow', who: [], sourceIds: ['requirements:form:2'] }]
    },
    {
      kind: 'meals' as const,
      id: 'meals:2026-07-14',
      destination: '/meals',
      schoolLunch: 'Pasta salad',
      dinner: 'Not planned'
    }
  ]
};

describe('ActiveBoard', () => {
  it('shows card-shaped placeholders while the board query is loading', () => {
    render(ActiveBoard, {
      props: { data: undefined, isPending: true, error: null }
    });

    expect(screen.getByRole('status').textContent).toContain('Loading noticeboard');
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  it('explains query failures and offers a retry action', async () => {
    const { emitted } = render(ActiveBoard, {
      props: { data: undefined, isPending: false, error: new Error('Connection failed') }
    });

    expect(screen.getByRole('alert').textContent).toContain('Household noticeboard is unavailable');
    await screen.getByRole('button', { name: 'Retry loading noticeboard' }).click();
    expect(emitted()).toHaveProperty('retry');
  });

  it('renders Today before Today’s Meals with canonical destinations', () => {
    render(ActiveBoard, {
      props: { data: completeBoard, isPending: false, error: null }
    });

    const cards = screen.getAllByRole('article');
    expect(within(cards[0]!).getByRole('heading', { name: 'Tuesday ready' })).not.toBeNull();
    expect(within(cards[0]!).getByText('Morning · memberA — Bring library bag')).not.toBeNull();
    expect(within(cards[0]!).getByText(/Afternoon · memberB — Bring sports bag/)).not.toBeNull();
    expect(within(cards[0]!).getByText('Watchout · Signed form due tomorrow')).not.toBeNull();
    expect(within(cards[0]!).getByRole('link', { name: 'Open Schedule' }).getAttribute('href')).toBe(
      'http://localhost:3003/'
    );

    expect(within(cards[1]!).getByRole('heading', { name: 'Today’s Meals' })).not.toBeNull();
    expect(within(cards[1]!).getByText('School lunch · Pasta salad')).not.toBeNull();
    expect(within(cards[1]!).getByText('Dinner · Not planned')).not.toBeNull();
    expect(within(cards[1]!).getByRole('link', { name: 'Open Meals' }).getAttribute('href')).toBe(
      'http://localhost:3005/'
    );
  });

  it('preserves the authenticated cross-origin handoff for local app links', () => {
    render(ActiveBoard, {
      props: { data: completeBoard, isPending: false, error: null },
      global: {
        provide: {
          [homeUrlBuilderKey as symbol]: (url: string) => `${url}?__clerk_db_jwt=test-token`
        }
      }
    });

    expect(screen.getByRole('link', { name: 'Open Schedule' }).getAttribute('href')).toBe(
      'http://localhost:3003/?__clerk_db_jwt=test-token'
    );
    expect(screen.getByRole('link', { name: 'Open Meals' }).getAttribute('href')).toBe(
      'http://localhost:3005/?__clerk_db_jwt=test-token'
    );
  });

  it('distinguishes an empty briefing from missing meal assignments', () => {
    render(ActiveBoard, {
      props: {
        data: {
          localDate: '2026-07-19',
          timeZone: 'Australia/Sydney',
          items: [
            {
              kind: 'today',
              id: 'today:2026-07-19',
              destination: '/schedule',
              briefingStatus: 'missing',
              headline: 'Today',
              generatedAt: null,
              morning: [],
              laterToday: [],
              watchouts: []
            },
            {
              kind: 'meals',
              id: 'meals:2026-07-19',
              destination: '/meals',
              schoolLunch: 'Not planned',
              dinner: 'Not planned'
            }
          ]
        },
        isPending: false,
        error: null
      }
    });

    expect(screen.getByText('No morning briefing is available yet.')).not.toBeNull();
    expect(screen.getByText('School lunch · Not planned')).not.toBeNull();
    expect(screen.getByText('Dinner · Not planned')).not.toBeNull();
  });

  it('shows a calm state when today’s stored briefing has no items', () => {
    render(ActiveBoard, {
      props: {
        data: {
          ...completeBoard,
          items: completeBoard.items.map((item) =>
            item.kind === 'today'
              ? {
                  ...item,
                  briefingStatus: 'empty' as const,
                  morning: [],
                  laterToday: [],
                  watchouts: []
                }
              : item
          )
        },
        isPending: false,
        error: null
      }
    });

    expect(screen.getByText('Nothing needs attention in the morning briefing.')).not.toBeNull();
  });

  it.each([
    ['Pasta salad', 'Vegetable bake'],
    ['Pasta salad', 'Not planned'],
    ['Not planned', 'Vegetable bake'],
    ['Not planned', 'Not planned']
  ])('shows lunch %s and dinner %s independently', (schoolLunch, dinner) => {
    render(ActiveBoard, {
      props: {
        data: {
          ...completeBoard,
          items: completeBoard.items.map((item) => (item.kind === 'meals' ? { ...item, schoolLunch, dinner } : item))
        },
        isPending: false,
        error: null
      }
    });

    expect(screen.getByText(`School lunch · ${schoolLunch}`)).not.toBeNull();
    expect(screen.getByText(`Dinner · ${dinner}`)).not.toBeNull();
  });
});
