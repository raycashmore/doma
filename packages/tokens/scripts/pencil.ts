import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { repositoryRoot } from './cli.ts';
import { object, readJson } from './files.ts';
import { tokenFiles } from './generate.ts';

export const supportedPenVersion = '1.2.20';
type Definition = { type: 'color'; value: string } | { type: 'number'; value: number };
export type ManagedVariables = Record<string, Definition>;

export function managedVariables(manifest: unknown): ManagedVariables {
  const data = object(manifest);
  if (data.schemaVersion !== 1 || data.target !== 'design/design-system.pen')
    throw new Error('Unsupported Pencil manifest version or target');
  const variables: ManagedVariables = {};
  for (const [name, raw] of Object.entries(object(data.variables))) {
    const definition = object(raw);
    const expectedType = /^(doma-web|doma-android)-color-content-primary$/.test(name)
      ? 'color'
      : /^(doma-web|doma-android)-space-list-item-content-gap$/.test(name)
        ? 'number'
        : undefined;
    if (!expectedType || definition.type !== expectedType) throw new Error(`Invalid managed name/type ${name}`);
    if (
      definition.type === 'color' &&
      typeof definition.value === 'string' &&
      /^#[0-9a-f]{6}([0-9a-f]{2})?$/i.test(definition.value)
    )
      variables[name] = { type: 'color', value: definition.value };
    else if (
      definition.type === 'number' &&
      typeof definition.value === 'number' &&
      Number.isFinite(definition.value) &&
      definition.value >= 0
    )
      variables[name] = { type: 'number', value: definition.value };
    else throw new Error(`Unsupported Pencil value/type ${name}`);
  }
  if (Object.keys(variables).length !== 4) throw new Error('Expected the four adopted Pencil variables');
  return variables;
}

export function pencilApplyScript(desired: ManagedVariables, previous: ManagedVariables, appVersion: string): string {
  if (appVersion !== supportedPenVersion)
    throw new Error(`Unsupported Pen API version ${appVersion}; verify the adapter before updating`);
  const names = Object.keys(desired).sort();
  if (Object.keys(previous).some((name) => !names.includes(name))) throw new Error('Unexpected previous managed name');
  return `const desired = ${JSON.stringify(desired)};
const previous = ${JSON.stringify(previous)};
if (typeof GetVariables !== 'function' || typeof SetVariables !== 'function' || typeof Get !== 'function') throw new Error('Unsupported Pen API');
const before = GetVariables().variables;
const names = Object.keys(desired).sort();
for (const name of Object.keys(before).filter(n => n.startsWith('doma-'))) if (!names.includes(name)) throw new Error('Unexpected managed name '+name);
for (const name of names) {
  const actual = before[name], expected = previous[name];
  if (actual?.type !== expected?.type || JSON.stringify(actual?.value) !== JSON.stringify(expected?.value)) throw new Error('Managed collision or changed precondition '+name);
  if (actual && actual.type !== desired[name].type) throw new Error('Managed type collision '+name);
}
const topology = () => JSON.stringify(Get((n,c) => { const {children,...properties}=n; return {parent:c.parentCtx?.node.id??null,...properties}; }));
const original = topology();
SetVariables(desired);
const after = GetVariables().variables;
for (const name of names) if (after[name]?.type !== desired[name].type || JSON.stringify(after[name]?.value) !== JSON.stringify(desired[name].value)) throw new Error('Pencil apply mismatch '+name);
for (const name of Object.keys(before).filter(n => !names.includes(n))) if (JSON.stringify(before[name]) !== JSON.stringify(after[name])) throw new Error('Unrelated variable changed '+name);
if (topology() !== original) throw new Error('Pencil bindings or topology changed');
Print('Managed variables applied; unrelated variables, bindings and topology preserved');`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const previousPath = process.argv[2];
  const previous = previousPath ? managedVariables(readJson(path.resolve(previousPath))) : {};
  const desired = managedVariables(JSON.parse((await tokenFiles(repositoryRoot))['pencil/variables.json']!));
  const version = execFileSync(
    '/usr/libexec/PlistBuddy',
    ['-c', 'Print :CFBundleShortVersionString', '/Applications/Pen.app/Contents/Info.plist'],
    { encoding: 'utf8' }
  ).trim();
  process.stdout.write(pencilApplyScript(desired, previous, version));
}
