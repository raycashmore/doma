import type { MemberConfig } from './mapping';

export type ScheduleDisplayMember = {
  id: string;
  label: string;
  initials: string;
};

export function parseJsonEnv<T>(name: string, raw: string, fallback: string): T {
  try {
    return JSON.parse(raw || fallback) as T;
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(`${name} env var is not valid JSON: ${detail}`);
  }
}

function initialsFromLabel(label: string): string {
  const words = label
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
  const initials = words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join('');
  return initials || label[0]?.toUpperCase() || '?';
}

export function displayMembersFromConfig(members: MemberConfig[]): ScheduleDisplayMember[] {
  return members.map((member) => {
    const label = member.label?.trim() || member.tokens[0]?.trim() || member.id;
    return {
      id: member.id,
      label,
      initials: member.initials?.trim() || initialsFromLabel(label)
    };
  });
}

export function parseScheduleMembers(): MemberConfig[] {
  return parseJsonEnv<MemberConfig[]>('SCHEDULE_MEMBERS', process.env.SCHEDULE_MEMBERS ?? '', '[]');
}
