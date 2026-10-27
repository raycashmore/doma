import { readFileSync } from 'node:fs';

import type { JSONSchemaType } from 'ajv';
import { Ajv } from 'ajv';
import { fullFormats } from 'ajv-formats/dist/formats.js';

import { localFile, object, readJson, unique } from './files.ts';
export type Platform = 'web' | 'android';

type Profile = {
  schemaVersion: 1;
  format: string;
  allowedTypes: string[];
  aliasPolicy: string;
  conversions: { web: string; android: string };
  platforms: { web: { sources: string[]; reason: string }; android: { sources: string[]; reason: string } };
  roles: { id: string; type: 'color' | 'dimension'; meaning: string; pencilNames: { web: string; android: string } }[];
};
const text = { type: 'string', minLength: 1 } as const;
const variants = {
  type: 'object',
  additionalProperties: false,
  required: ['web', 'android'],
  properties: { web: text, android: text }
} as const;
const selection = {
  type: 'object',
  additionalProperties: false,
  required: ['sources', 'reason'],
  properties: { sources: { type: 'array', minItems: 1, uniqueItems: true, items: text }, reason: text }
} as const;
const schema = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'format', 'allowedTypes', 'aliasPolicy', 'conversions', 'platforms', 'roles'],
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    format: { type: 'string', const: 'DTCG 2025.10' },
    aliasPolicy: text,
    allowedTypes: {
      type: 'array',
      minItems: 2,
      maxItems: 2,
      uniqueItems: true,
      items: { type: 'string', enum: ['color', 'dimension'] }
    },
    conversions: variants,
    platforms: {
      type: 'object',
      additionalProperties: false,
      required: ['web', 'android'],
      properties: { web: selection, android: selection }
    },
    roles: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['id', 'type', 'meaning', 'pencilNames'],
        properties: {
          id: text,
          type: { type: 'string', enum: ['color', 'dimension'] },
          meaning: text,
          pencilNames: variants
        }
      }
    }
  }
} satisfies JSONSchemaType<Profile>;
const dtcgSchema = JSON.parse(
  readFileSync(new URL('../schema/dtcg-2025.10-format.json', import.meta.url), 'utf8')
) as object;
const dtcgAjv = new Ajv({ allErrors: true, strict: false });
for (const [name, format] of Object.entries(fullFormats)) dtcgAjv.addFormat(name, format);
const validateDtcg = dtcgAjv.compile(dtcgSchema);
const validate = new Ajv({ allErrors: true }).compile<Profile>(schema);
type Token = { type: string; value: unknown };
export function loadTokens(root: string) {
  const value = readJson(localFile(root, 'packages/tokens/profile.json'));
  if (!validate(value)) throw new Error(`Invalid token profile: ${JSON.stringify(validate.errors)}`);
  const profile = value;
  unique(
    profile.roles.map((role) => role.id),
    'token roles'
  );
  unique(
    profile.roles.flatMap((role) => Object.values(role.pencilNames)),
    'Pencil names'
  );
  for (const role of profile.roles)
    for (const platform of ['web', 'android'] as const) {
      if (!new RegExp(`^doma-${platform}-[a-z][a-z0-9-]*$`).test(role.pencilNames[platform]))
        throw new Error(`Invalid managed Pencil name ${role.pencilNames[platform]}`);
    }
  const tokens = new Map<Platform, Map<string, Token>>();
  for (const platform of ['web', 'android'] as const) {
    const selected = new Map<string, Token>();
    const names = new Set<string>();
    function collect(group: unknown, prefix: string[]) {
      for (const [key, raw] of Object.entries(object(group))) {
        if (key.startsWith('$')) {
          if (key !== '$description') throw new Error(`Unsupported token group property ${key}`);
          continue;
        }
        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) throw new Error(`Invalid token name ${key}`);
        const child = object(raw);
        const id = [...prefix, key].join('.');
        if ('$value' in child) {
          if (
            !profile.allowedTypes.includes(String(child.$type)) ||
            Object.keys(child).some((k) => !['$type', '$value', '$description'].includes(k))
          )
            throw new Error(`Unsupported token ${id}`);
          if (selected.has(id)) throw new Error(`Duplicate token ${id}`);
          const name = outputName(id);
          if (names.has(name)) throw new Error(`Output identifier collision ${id}`);
          names.add(name);
          selected.set(id, { type: String(child.$type), value: child.$value });
        } else collect(child, [...prefix, key]);
      }
    }
    for (const source of profile.platforms[platform].sources) {
      const data = readJson(localFile(root, `packages/tokens/${source}`));
      if (!validateDtcg(data)) throw new Error(`Invalid DTCG source ${source}: ${JSON.stringify(validateDtcg.errors)}`);
      collect(data, []);
    }
    function resolve(id: string, chain: string[] = []): unknown {
      if (chain.includes(id)) throw new Error(`Token alias cycle: ${[...chain, id].join(' -> ')}`);
      const token = selected.get(id);
      if (!token) throw new Error(`Unknown token ${id} (${platform})`);
      if (typeof token.value === 'string') {
        const match = /^\{([^{}]+)\}$/.exec(token.value);
        if (!match || !match[1]) throw new Error(`Unsupported alias ${id}`);
        if (selected.get(match[1])?.type !== token.type) throw new Error(`Alias type mismatch ${id}`);
        return resolve(match[1], [...chain, id]);
      }
      const literal = object(token.value);
      if (token.type === 'color') {
        if (
          literal.colorSpace !== 'srgb' ||
          !Array.isArray(literal.components) ||
          literal.components.length !== 3 ||
          !literal.components.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) ||
          Object.keys(literal).some((key) => !['colorSpace', 'components', 'alpha'].includes(key)) ||
          typeof literal.alpha !== 'number' ||
          !Number.isFinite(literal.alpha) ||
          literal.alpha < 0 ||
          literal.alpha > 1
        )
          throw new Error(`Unsupported sRGB token ${id}`);
      } else if (
        Object.keys(literal).some((key) => !['value', 'unit'].includes(key)) ||
        literal.unit !== 'px' ||
        typeof literal.value !== 'number' ||
        !Number.isFinite(literal.value) ||
        literal.value < 0
      )
        throw new Error(`Unsupported layout dimension ${id}`);
      return literal;
    }
    for (const id of selected.keys()) resolve(id);
    for (const role of profile.roles) {
      if (selected.get(role.id)?.type !== role.type)
        throw new Error(`Unknown or mistyped role ${role.id} (${platform})`);
    }
    tokens.set(platform, selected);
  }
  return { profile, tokens };
}

export function outputName(id: string): string {
  return id
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replaceAll('.', '-')
    .toLowerCase();
}
