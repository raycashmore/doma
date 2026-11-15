import { describe, expect, it } from 'vitest';

// Every public query, mutation and action must reject a signed-out caller before it reads or writes
// anything. User functions throw 'Not authenticated'; bot functions throw 'Unauthorized' without a
// service token. A new public function that skips its check fails here. Make it internal if no client
// calls it. HTTP actions get no signed-out check here, so the test fails when one appears: give it
// its own check first. Not covered: whether a signed-in user may see a row.

type ExportedValidator = { type: string; [key: string]: unknown };
type ExportedField = { fieldType: ExportedValidator; optional: boolean };

type RegisteredFunction = {
  isPublic?: boolean;
  exportArgs: () => string;
  _handler: (ctx: unknown, args: unknown) => unknown;
};

// Vitest provides Vite's import.meta.glob; this package has no direct vite dependency for its types.
type GlobImportMeta = ImportMeta & {
  glob: (patterns: string[], options: { eager: true }) => Record<string, Record<string, unknown>>;
};

const modules = (import.meta as GlobImportMeta).glob(['./**/*.ts', '!./**/*.test.ts', '!./_generated/**'], {
  eager: true
});

function isPublicFunction(value: unknown): value is RegisteredFunction {
  const fn = value as Partial<RegisteredFunction> | null;
  return Boolean(fn?.isPublic && typeof fn._handler === 'function' && typeof fn.exportArgs === 'function');
}

const publicFunctions = Object.entries(modules).flatMap(([file, exports]) =>
  Object.entries(exports)
    .filter(([, value]) => isPublicFunction(value))
    .map(([name, fn]) => [`${file.slice(2, -3)}:${name}`, fn as RegisteredFunction] as const)
);

// The smallest value each validator accepts, so handlers that validate arguments first still reach their
// sign-in check.
function sampleValue(validator: ExportedValidator): unknown {
  switch (validator.type) {
    case 'object':
      return Object.fromEntries(
        Object.entries(validator.value as Record<string, ExportedField>)
          .filter(([, field]) => !field.optional)
          .map(([key, field]) => [key, sampleValue(field.fieldType)])
      );
    case 'union':
      return sampleValue((validator.value as ExportedValidator[])[0]!);
    case 'literal':
      return validator.value;
    case 'string':
    case 'id':
      return 'sample';
    case 'number':
      return 1;
    case 'bigint':
      return 1n;
    case 'boolean':
      return true;
    case 'null':
      return null;
    case 'array':
      return [sampleValue(validator.value as ExportedValidator)];
    case 'record':
      return {};
    case 'bytes':
      return new ArrayBuffer(0);
    case 'any':
      return {};
    default:
      throw new Error(`No sample for validator type ${validator.type}`);
  }
}

function signedOutCtx() {
  const auth = { getUserIdentity: async () => null };
  return new Proxy(
    { auth },
    {
      get(target, prop) {
        if (prop === 'auth') return target.auth;
        throw new Error(`Touched ctx.${String(prop)} before checking sign-in`);
      }
    }
  );
}

describe('public Convex functions', () => {
  it('finds the registered functions', () => {
    const ids = publicFunctions.map(([id]) => id);
    expect(ids).toContain('queries:getBudgetPageSummary');
    expect(ids).toContain('lists/mutations:createListItem');
    expect(ids.length).toBeGreaterThan(50);
  });

  it('has no HTTP actions this test cannot check', () => {
    const httpActions = Object.entries(modules).flatMap(([file, exports]) =>
      Object.entries(exports)
        .filter(([, value]) => (value as { isHttp?: boolean } | null)?.isHttp)
        .map(([name]) => `${file}:${name}`)
    );
    expect(httpActions).toEqual([]);
  });

  it.each(publicFunctions)('%s rejects a signed-out caller', async (_id, fn) => {
    const args = sampleValue(JSON.parse(fn.exportArgs()) as ExportedValidator);
    await expect(Promise.resolve().then(() => fn._handler(signedOutCtx(), args))).rejects.toThrow(
      /^(Not authenticated|Unauthorized)$/
    );
  });
});
