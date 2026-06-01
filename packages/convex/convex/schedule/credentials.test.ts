import { describe, expect, it } from 'vitest';
import { normalizePrivateKey } from './credentials';

describe('normalizePrivateKey', () => {
  it('converts escaped newlines to real newlines (env-var round-trip)', () => {
    const escaped =
      '-----BEGIN PRIVATE KEY-----\\nABCDEF\\n-----END PRIVATE KEY-----\\n';
    expect(normalizePrivateKey(escaped)).toBe(
      '-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----'
    );
  });

  it('keeps internal real newlines intact', () => {
    const real =
      '-----BEGIN PRIVATE KEY-----\nABCDEF\n-----END PRIVATE KEY-----';
    expect(normalizePrivateKey(real)).toBe(real);
  });

  it('trims surrounding whitespace and trailing newlines', () => {
    const padded =
      '  -----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----\n  ';
    expect(normalizePrivateKey(padded)).toBe(
      '-----BEGIN PRIVATE KEY-----\nABC\n-----END PRIVATE KEY-----'
    );
  });
});
