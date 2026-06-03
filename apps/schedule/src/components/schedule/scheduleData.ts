export const MEMBER_IDS = ['memberA', 'memberB', 'memberC', 'memberD'] as const;

export type MemberId = (typeof MEMBER_IDS)[number];

export type ScheduleMember = {
  id: MemberId;
  label: string;
  initials: string;
  colorClass: string;
};

export const MEMBERS = [
  { id: 'memberA', label: 'Member A', initials: 'A', colorClass: 'member-a' },
  { id: 'memberB', label: 'Member B', initials: 'B', colorClass: 'member-b' },
  { id: 'memberC', label: 'Member C', initials: 'C', colorClass: 'member-c' },
  { id: 'memberD', label: 'Member D', initials: 'D', colorClass: 'member-d' }
] satisfies ScheduleMember[];

export const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

export type DayLabel = (typeof DAY_LABELS)[number];

export const SWIMLANE_START_MINUTES = 6 * 60;
export const SWIMLANE_END_MINUTES = 22 * 60;
export const SWIMLANE_TOTAL_MINUTES = SWIMLANE_END_MINUTES - SWIMLANE_START_MINUTES;
