import { describe, expect, it } from 'vitest';

import { buildListPublicId, slugifyListName } from './model';

describe('slugifyListName', () => {
  it('normalizes a list name into a lowercase hyphen slug', () => {
    expect(slugifyListName('Shared shopping')).toBe('shared-shopping');
  });

  it('falls back to a stable default when the name is blank after trimming', () => {
    expect(slugifyListName('   ')).toBe('list');
  });
});

describe('buildListPublicId', () => {
  it('returns a stable external-looking identifier', () => {
    expect(buildListPublicId('abc123')).toBe('list_abc123');
  });
});
