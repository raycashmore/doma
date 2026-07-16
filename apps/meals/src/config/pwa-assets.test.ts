import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const iconDirectory = resolve(process.cwd(), 'public/icons');
const styles = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
const viteConfig = readFileSync(resolve(process.cwd(), 'vite.config.ts'), 'utf8');

const iconFiles = [
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
  'icon-maskable-192.png',
  'icon-maskable-512.png',
  'icon-maskable.svg',
  'icon.svg'
];

describe('Meals PWA assets', () => {
  it('ships the shared application icons', () => {
    for (const iconFile of iconFiles) {
      expect(existsSync(`${iconDirectory}/${iconFile}`), iconFile).toBe(true);
    }
  });

  it('declares the install icons in the generated manifest configuration', () => {
    expect(viteConfig).toContain('src: `${MEALS_BASE_URL}icons/icon.svg`');
    expect(viteConfig).toContain('src: `${MEALS_BASE_URL}icons/icon-192.png`');
    expect(viteConfig).toContain('src: `${MEALS_BASE_URL}icons/icon-512.png`');
    expect(viteConfig).toContain('src: `${MEALS_BASE_URL}icons/icon-maskable-192.png`');
    expect(viteConfig).toContain('src: `${MEALS_BASE_URL}icons/icon-maskable-512.png`');
  });

  it('hides the shared mobile navigation when installed as a standalone app', () => {
    expect(styles).toMatch(
      /@media\s*\(display-mode:\s*standalone\)\s*\{[\s\S]*?\.mobile-app-nav\s*\{[\s\S]*?display:\s*none;?[\s\S]*?\}\s*\}/
    );
  });
});
