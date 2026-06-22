import { describe, expect, it } from 'vitest';

import { formatConfirmation } from './confirmation';

describe('formatConfirmation', () => {
  it('lists every item title and the target list on success', () => {
    const text = formatConfirmation({
      kind: 'created',
      listName: 'Shopping',
      itemTitles: ['milk', 'bread', 'eggs']
    });

    expect(text).toBe('Added 3 items to Shopping:\n• milk\n• bread\n• eggs');
  });

  it('uses the singular form for a single item', () => {
    const text = formatConfirmation({ kind: 'created', listName: 'Shopping', itemTitles: ['batteries'] });

    expect(text).toBe('Added 1 item to Shopping:\n• batteries');
  });

  it('asks the user to set a default when none is configured', () => {
    const text = formatConfirmation({ kind: 'no_default' });

    expect(text).toContain('default list');
    expect(text.toLowerCase()).toContain('doma');
  });

  it('explains when nothing usable could be parsed', () => {
    const text = formatConfirmation({ kind: 'empty_parse' });

    expect(text).toContain("couldn't");
  });

  it('notes the fallback to the default list when a named list could not be resolved', () => {
    const text = formatConfirmation({
      kind: 'created_with_fallback',
      requestedListName: 'garden',
      listName: 'Shopping',
      itemTitles: ['compost', 'seeds']
    });

    expect(text).toContain("couldn't find 'garden'");
    expect(text).toContain('Shopping');
    expect(text).toContain('your default');
    // Still echoes every captured item title.
    expect(text).toContain('• compost');
    expect(text).toContain('• seeds');
  });

  it('explains the fallback generically when no trustworthy requested name exists', () => {
    const text = formatConfirmation({
      kind: 'created_with_fallback',
      requestedListName: null,
      listName: 'Shopping',
      itemTitles: ['compost']
    });

    expect(text).not.toContain("couldn't find '");
    expect(text).toContain('Shopping');
    expect(text).toContain('your default');
    expect(text).toContain('• compost');
  });
});
