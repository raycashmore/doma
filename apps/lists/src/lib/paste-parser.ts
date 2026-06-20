export type ParsedPaste = {
  items: string[];
  headings: string[];
};

// Leading list markers: checkbox glyphs, bullets, and numbered prefixes.
const LEADING_MARKER = /^\s*(?:[-*•·–—]|[☐☑☒✓✔]|\d+[.)])\s*/;

// Normalise a single parsed line: strip a leading marker, drop trailing list
// punctuation (commas/semicolons) left over from a delimited paste, and trim.
function normalizeLine(line: string): string {
  return line
    .replace(LEADING_MARKER, '')
    .replace(/[,;]+$/, '')
    .trim();
}

export function parsePastedItems(text: string): ParsedPaste {
  const trimmed = text.trim();

  // Newlines take precedence: a multi-line paste is already delimited, so split
  // on lines and leave any commas inside a line as content.
  if (/\r?\n/.test(trimmed)) {
    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim().length > 0);

    // When some lines carry a marker, marker-less lines are read as category
    // headings rather than items. In a pure plain list (no markers anywhere)
    // every line is an item.
    const anyMarked = lines.some((line) => LEADING_MARKER.test(line));

    const items: string[] = [];
    const headings: string[] = [];
    for (const line of lines) {
      const text = normalizeLine(line);
      if (text.length === 0) continue;
      if (anyMarked && !LEADING_MARKER.test(line)) {
        headings.push(text);
      } else {
        items.push(text);
      }
    }
    return { items, headings };
  }

  // Only split a flat line on commas when there are at least two commas, so an
  // incidental comma inside a single item (e.g. "Milk, 2L") stays one item.
  const commaCount = (trimmed.match(/,/g) ?? []).length;
  if (commaCount >= 2) {
    const items = trimmed
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0);
    return { items, headings: [] };
  }

  return { items: trimmed.length > 0 ? [trimmed] : [], headings: [] };
}
