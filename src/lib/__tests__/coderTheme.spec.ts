import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCoderThemePreference, resolveCoderTheme } from '@/lib/coderTheme';

const root = process.cwd();

describe('coder theme preference', () => {
  it('accepts only the supported theme options', () => {
    expect(isCoderThemePreference('light')).toBe(true);
    expect(isCoderThemePreference('dark')).toBe(true);
    expect(isCoderThemePreference('auto')).toBe(true);
    expect(isCoderThemePreference('system')).toBe(false);
    expect(isCoderThemePreference(null)).toBe(false);
  });

  it('resolves auto from the device preference', () => {
    expect(resolveCoderTheme('auto', true)).toBe('dark');
    expect(resolveCoderTheme('auto', false)).toBe('light');
    expect(resolveCoderTheme('dark', false)).toBe('dark');
    expect(resolveCoderTheme('light', true)).toBe('light');
  });

  it('keeps Learning Journey readable with continuous routes and a phone-first vertical timeline', () => {
    const map = fs.readFileSync(
      path.join(root, 'src/app/(coder)/coder/dashboard/JourneyMap.tsx'),
      'utf8',
    );
    const modal = fs.readFileSync(
      path.join(root, 'src/app/(coder)/coder/dashboard/JourneyModal.tsx'),
      'utf8',
    );
    const styles = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');

    expect(map).toContain('journey-mobile px-4 pb-8 pt-1 md:hidden');
    expect(map).toContain('journey-mobile-list relative mx-auto flex max-w-sm flex-col');
    expect(map).toContain("blocks.findIndex((block) => block.status !== 'COMPLETED')");
    expect(map).toContain('Setiap langkah kecil hari ini membawamu ke petualangan hebat.');
    expect(map).toContain('journey-mobile-route');
    expect(map).toContain('journey-path-base');
    expect(map).toContain('journey-path-completed');
    expect(map).not.toContain('strokeDasharray');
    expect(map).toContain('hidden md:block');
    expect(modal).toContain('journey-modal-title');
    expect(modal).toContain('h-[100dvh]');
    expect(modal).not.toContain('body.scrollTop = body.scrollHeight');
    expect(styles).toContain("[data-coder-modal='true'] .journey-modal-title");
    expect(styles).toContain("[data-coder-modal='true'] .journey-card-current");
    expect(styles).toContain('.journey-path-base,');
    expect(styles).toContain('stroke-dasharray: none;');
    expect(styles).toContain('color: #f7fbff !important;');
  });
});
