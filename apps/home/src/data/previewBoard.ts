import type { api } from '@repo/convex';
import type { FunctionReturnType } from 'convex/server';

type ActiveBoardData = FunctionReturnType<typeof api.home.activeBoard.activeBoard>;

export const PREVIEW_BOARD = {
  localDate: '2026-07-13',
  timeZone: 'Australia/Sydney',
  items: [
    {
      kind: 'today',
      id: 'today:2026-07-13',
      destination: '/schedule',
      briefingStatus: 'available',
      headline: 'Today',
      generatedAt: Date.parse('2026-07-12T21:35:00.000Z'),
      morning: [{ text: 'Bring library bag', who: ['memberA'], sourceIds: ['requirements:bag:1'] }],
      laterToday: [
        {
          id: 'requirements-calendar:sport-kit:1',
          title: 'Bring sports bag',
          start: Date.parse('2026-07-13T06:00:00.000Z'),
          end: Date.parse('2026-07-13T06:30:00.000Z'),
          allDay: false,
          who: ['memberB'],
          destination: 'https://calendar.example.test/event/sport-kit'
        }
      ],
      watchouts: [{ text: 'Signed form due tomorrow', who: [], sourceIds: ['requirements:form:2'] }]
    },
    {
      kind: 'meals',
      id: 'meals:2026-07-13',
      destination: '/meals',
      schoolLunch: 'Pasta salad',
      dinner: 'Not planned'
    },
    {
      kind: 'sourceNotice',
      id: 'emailNotice:preview-permission-form',
      sourceKind: 'forwardedEmail',
      sourceApp: 'home',
      display: 'wide',
      priority: 'high',
      title: 'Permission form due',
      detail: 'Return the form before Friday.',
      facts: [{ label: 'due', value: 'Friday' }],
      occurredAt: Date.parse('2026-07-11T02:00:00.000Z'),
      destination: '/notices/preview-permission-form'
    },
    {
      kind: 'sourceNotice',
      id: 'spendingInsight:2026-06',
      sourceKind: 'monthlySpendingInsight',
      sourceApp: 'budget',
      display: 'standard',
      priority: 'medium',
      title: 'June spending settled',
      detail: 'Groceries drifted upward while dining out fell.',
      occurredAt: Date.parse('2026-07-01T02:00:00.000Z'),
      period: '2026-06',
      destination: '/budget'
    }
  ]
} satisfies ActiveBoardData;
