import type { JSONSchemaType } from 'ajv';
import { Ajv } from 'ajv';

export type Platform = 'web' | 'android';
export type Pattern = {
  schemaVersion: 1;
  id: string;
  kind: 'pattern';
  version: string;
  status: 'proposed' | 'approved' | 'deprecated';
  title: string;
  summary: string;
  tags: string[];
  roles: { id: string; meaning: string }[];
  states: { id: string; meaning: string }[];
  rules: { id: string; level: 'must' | 'should'; behaviour: string; platforms: Platform[] }[];
  tokenRoles: { id: string; platforms: Platform[] }[];
  implementations: {
    platform: Platform;
    framework: string;
    sourcePaths: string[];
    testPaths: string[];
    ruleIds: string[];
    stateIds: string[];
    exclusions: string[];
    gaps: string[];
  }[];
  designReferences: { path: string; nodeIds: string[]; assetPaths: string[]; illustrative: boolean }[];
};
const text = { type: 'string', minLength: 1 } as const;
const strings = { type: 'array', items: text, uniqueItems: true } as const;
const platforms = {
  type: 'array',
  minItems: 1,
  uniqueItems: true,
  items: { type: 'string', enum: ['web', 'android'] }
} as const;
const meanings = {
  type: 'array',
  minItems: 1,
  items: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'meaning'],
    properties: { id: text, meaning: text }
  }
} as const;
export const patternSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'id',
    'kind',
    'version',
    'status',
    'title',
    'summary',
    'tags',
    'roles',
    'states',
    'rules',
    'tokenRoles',
    'implementations',
    'designReferences'
  ],
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    id: { type: 'string', pattern: '^[a-z][a-z0-9]*(-[a-z0-9]+)*$' },
    kind: { type: 'string', const: 'pattern' },
    version: { type: 'string', pattern: '^[0-9]+\\.[0-9]+\\.[0-9]+$' },
    status: { type: 'string', enum: ['proposed', 'approved', 'deprecated'] },
    title: text,
    summary: text,
    tags: strings,
    roles: meanings,
    states: meanings,
    rules: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'level', 'behaviour', 'platforms'],
        properties: { id: text, level: { type: 'string', enum: ['must', 'should'] }, behaviour: text, platforms }
      }
    },
    tokenRoles: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'platforms'],
        properties: { id: text, platforms }
      }
    },
    implementations: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['platform', 'framework', 'sourcePaths', 'testPaths', 'ruleIds', 'stateIds', 'exclusions', 'gaps'],
        properties: {
          platform: { type: 'string', enum: ['web', 'android'] },
          framework: text,
          sourcePaths: { ...strings, minItems: 1 },
          testPaths: { ...strings, minItems: 1 },
          ruleIds: strings,
          stateIds: strings,
          exclusions: strings,
          gaps: strings
        }
      }
    },
    designReferences: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['path', 'nodeIds', 'assetPaths', 'illustrative'],
        properties: {
          path: text,
          nodeIds: { ...strings, minItems: 1 },
          assetPaths: { ...strings, minItems: 1 },
          illustrative: { type: 'boolean' }
        }
      }
    }
  }
} satisfies JSONSchemaType<Pattern>;
const validate = new Ajv({ allErrors: true }).compile<Pattern>(patternSchema);
export function parsePattern(value: unknown): Pattern {
  if (!validate(value)) throw new Error(`Invalid pattern: ${JSON.stringify(validate.errors)}`);
  return value;
}
