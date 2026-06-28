export type EvalCase<TInput, TExpect, TMetadata = Record<string, unknown>> = {
  id: string;
  input: TInput;
  expect: TExpect;
  metadata?: TMetadata;
};

type RawEvalCase = {
  id?: unknown;
  input?: unknown;
  expect?: unknown;
  metadata?: unknown;
};

export function loadJsonlDataset<TInput, TExpect, TMetadata = Record<string, unknown>>(
  content: string
): EvalCase<TInput, TExpect, TMetadata>[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line, index) => parseJsonlCase<TInput, TExpect, TMetadata>(line, index + 1));
}

function parseJsonlCase<TInput, TExpect, TMetadata>(
  line: string,
  lineNumber: number
): EvalCase<TInput, TExpect, TMetadata> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line) as unknown;
  } catch (error) {
    throw new Error(`Invalid JSONL on line ${lineNumber}: ${error instanceof Error ? error.message : String(error)}`);
  }

  if (!isRecord(parsed)) throw new Error(`Invalid eval case on line ${lineNumber}: expected an object`);

  const raw = parsed as RawEvalCase;
  if (typeof raw.id !== 'string' || raw.id.trim().length === 0) {
    throw new Error(`Invalid eval case on line ${lineNumber}: id must be a non-empty string`);
  }
  if (!('input' in raw)) throw new Error(`Invalid eval case ${raw.id}: missing input`);
  if (!('expect' in raw)) throw new Error(`Invalid eval case ${raw.id}: missing expect`);

  const testCase: EvalCase<TInput, TExpect, TMetadata> = {
    id: raw.id,
    input: raw.input as TInput,
    expect: raw.expect as TExpect
  };
  if ('metadata' in raw) testCase.metadata = raw.metadata as TMetadata;
  return testCase;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
