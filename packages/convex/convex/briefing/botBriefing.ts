import type { BotMorningBriefing } from './delivery';

function invalidGeneratedBriefingResult(reason: string) {
  return new Error(`Invalid generated briefing result: ${reason}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function shouldSendFromGeneratedBriefingRow(row: Record<string, unknown>) {
  if (typeof row.shouldSend === 'boolean') {
    return row.shouldSend;
  }

  if (isRecord(row.briefing) && typeof row.briefing.shouldSend === 'boolean') {
    return row.briefing.shouldSend;
  }

  return null;
}

function isBriefingLine(value: unknown) {
  return (
    isRecord(value) &&
    typeof value.text === 'string' &&
    Array.isArray(value.who) &&
    value.who.every((item) => typeof item === 'string') &&
    Array.isArray(value.sourceIds) &&
    value.sourceIds.every((item) => typeof item === 'string')
  );
}

function isStructuredMorningBriefing(value: unknown): value is NonNullable<BotMorningBriefing['briefing']> {
  return (
    isRecord(value) &&
    typeof value.shouldSend === 'boolean' &&
    typeof value.headline === 'string' &&
    Array.isArray(value.morning) &&
    value.morning.every(isBriefingLine) &&
    Array.isArray(value.afternoon) &&
    value.afternoon.every(isBriefingLine) &&
    Array.isArray(value.watchouts) &&
    value.watchouts.every(isBriefingLine) &&
    Array.isArray(value.sourceIdsIgnored) &&
    value.sourceIdsIgnored.every((item) => typeof item === 'string')
  );
}

function structuredMorningBriefingFromRow(value: unknown): BotMorningBriefing['briefing'] | undefined {
  if (!isStructuredMorningBriefing(value)) {
    return undefined;
  }

  return value;
}

export function botMorningBriefingFromStoreResult(value: unknown): BotMorningBriefing {
  if (!isRecord(value) || !('briefing' in value)) {
    throw invalidGeneratedBriefingResult('missing top-level briefing field');
  }

  const row = value.briefing;
  if (!isRecord(row)) {
    throw invalidGeneratedBriefingResult('briefing field is not an object');
  }

  const shouldSend = shouldSendFromGeneratedBriefingRow(row);
  if (
    typeof row.briefingKey !== 'string' ||
    typeof row.localDate !== 'string' ||
    typeof row.message !== 'string' ||
    shouldSend === null ||
    (row.generationStatus !== 'ai' &&
      row.generationStatus !== 'deterministic' &&
      row.generationStatus !== 'fallback' &&
      row.generationStatus !== 'setupProblem')
  ) {
    throw invalidGeneratedBriefingResult('briefing payload is missing required bot fields');
  }

  const structuredBriefing = structuredMorningBriefingFromRow(row.briefing);

  return {
    briefingKey: row.briefingKey,
    localDate: row.localDate,
    generationStatus: row.generationStatus,
    shouldSend,
    message: row.message,
    ...(structuredBriefing ? { briefing: structuredBriefing } : {})
  };
}
