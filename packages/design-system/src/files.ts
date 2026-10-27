import { readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';

export function readJson(filename: string): unknown {
  return JSON.parse(readFileSync(filename, 'utf8')) as unknown;
}
export function localFile(root: string, relative: string): string {
  if (
    !relative ||
    relative.includes('\\') ||
    relative.split('/').some((part) => part === '..' || part === '.' || !part) ||
    path.isAbsolute(relative)
  ) {
    throw new Error(`Unsafe repository path: ${relative}`);
  }
  const filename = path.join(root, relative);
  const real = realpathSync(filename);
  if (!real.startsWith(`${realpathSync(root)}${path.sep}`) || !statSync(real).isFile())
    throw new Error(`Invalid repository file: ${relative}`);
  return filename;
}
export function unique(values: string[], context: string): void {
  if (new Set(values).size !== values.length) throw new Error(`Duplicate ${context}`);
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Expected an object');
  return value as Record<string, unknown>;
}
