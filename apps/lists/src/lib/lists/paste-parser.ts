export type PasteEntry = {
  kind: 'item' | 'heading';
  text: string;
};

export type ParsedPaste = {
  entries: PasteEntry[];
  items: string[];
  headings: string[];
};

// Leading list markers: checkbox glyphs, bullets, and numbered prefixes.
const LEADING_MARKER = /^\s*(?:[-*•·–—]|[☐☑☒✓✔]|\d+[.)])\s*/;

// Insert a line break before each inline marker so a flat marked list
// ("☐ milk ☐ eggs", "- a, - b", "1. x 2. y") is split the same way as a
// return-separated one. Markers therefore take precedence over commas.
function breakBeforeInlineMarkers(text: string): string {
  return (
    text
      // Checkbox glyphs split even when glued to the next word ("☐milk").
      .replace(/\s*(?=[☐☑☒✓✔])/g, '\n')
      // Bullets and numbered markers only split when whitespace-bounded, so a
      // hyphen or number inside an item ("Milk, 2L", "low-fat") is left alone.
      .replace(/\s+(?=(?:[-*•·–—]|\d+[.)])\s)/g, '\n')
  );
}

// Normalise a single parsed line: strip a leading marker, drop trailing list
// punctuation (commas/semicolons) left over from a delimited paste, and trim.
function normalizeLine(line: string): string {
  return line
    .replace(LEADING_MARKER, '')
    .replace(/[,;]+$/, '')
    .trim();
}

function fromEntries(entries: PasteEntry[]): ParsedPaste {
  return {
    entries,
    items: entries.filter((entry) => entry.kind === 'item').map((entry) => entry.text),
    headings: entries.filter((entry) => entry.kind === 'heading').map((entry) => entry.text)
  };
}

function parseLines(source: string): ParsedPaste {
  const lines = source.split(/\r?\n/).filter((line) => line.trim().length > 0);

  // When some lines carry a marker, marker-less lines are read as category
  // headings rather than items. In a pure plain list (no markers anywhere)
  // every line is an item.
  const anyMarked = lines.some((line) => LEADING_MARKER.test(line));

  const entries: PasteEntry[] = [];
  for (const line of lines) {
    const text = normalizeLine(line);
    if (text.length === 0) continue;
    const kind = anyMarked && !LEADING_MARKER.test(line) ? 'heading' : 'item';
    entries.push({ kind, text });
  }

  return fromEntries(entries);
}

export function parsePastedItems(text: string): ParsedPaste {
  const trimmed = text.trim();
  if (trimmed.length === 0) return fromEntries([]);

  // Newlines (real, or introduced by inline markers) take precedence: the paste
  // is already delimited, so split on lines and leave commas inside as content.
  const lineSource = breakBeforeInlineMarkers(trimmed);
  if (/\r?\n/.test(lineSource)) {
    return parseLines(lineSource);
  }

  // Only split a flat line on commas when there are at least two commas, so an
  // incidental comma inside a single item (e.g. "Milk, 2L") stays one item.
  const commaCount = (trimmed.match(/,/g) ?? []).length;
  if (commaCount >= 2) {
    const entries: PasteEntry[] = trimmed
      .split(',')
      .map((value) => normalizeLine(value))
      .filter((value) => value.length > 0)
      .map((value) => ({ kind: 'item', text: value }));
    return fromEntries(entries);
  }

  return fromEntries([{ kind: 'item', text: trimmed }]);
}
