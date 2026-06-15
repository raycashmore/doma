export const LIST_VISIBILITIES = ['personal', 'shared'] as const;

export type ListVisibility = (typeof LIST_VISIBILITIES)[number];

export function slugifyListName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'list';
}

export function buildListPublicId(seed: string): string {
  return `list_${seed}`;
}
