export type ConfirmationOutcome =
  | { kind: 'created'; listName: string; itemTitles: string[] }
  | { kind: 'created_with_fallback'; requestedListName: string; listName: string; itemTitles: string[] }
  | { kind: 'no_default' }
  | { kind: 'empty_parse' };

const NO_DEFAULT_MESSAGE =
  "I don't have a default list to add to yet. Open Doma, go to Lists, and choose a default list — then send that again.";

const EMPTY_PARSE_MESSAGE = "I couldn't pick out anything to add. Try something like “milk, bread, eggs”.";

function createdLines(listName: string, itemTitles: string[], heading?: string): string {
  const count = itemTitles.length;
  const noun = count === 1 ? 'item' : 'items';
  const lines = itemTitles.map((title) => `• ${title}`);
  const addedLine = `Added ${count} ${noun} to ${listName}:`;
  return [...(heading ? [heading] : []), addedLine, ...lines].join('\n');
}

export function formatConfirmation(outcome: ConfirmationOutcome): string {
  switch (outcome.kind) {
    case 'created':
      return createdLines(outcome.listName, outcome.itemTitles);
    case 'created_with_fallback':
      return createdLines(
        outcome.listName,
        outcome.itemTitles,
        `I couldn't find '${outcome.requestedListName}' — added to ${outcome.listName} (your default).`
      );
    case 'no_default':
      return NO_DEFAULT_MESSAGE;
    case 'empty_parse':
      return EMPTY_PARSE_MESSAGE;
  }
}
