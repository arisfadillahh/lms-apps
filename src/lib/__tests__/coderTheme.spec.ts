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

  it('keeps Learning Journey readable in dark mode and vertical on phones', () => {
    const map = fs.readFileSync(
      path.join(root, 'src/app/(coder)/coder/dashboard/JourneyMap.tsx'),
      'utf8',
    );
    const modal = fs.readFileSync(
      path.join(root, 'src/app/(coder)/coder/dashboard/JourneyModal.tsx'),
      'utf8',
    );
    const styles = fs.readFileSync(path.join(root, 'src/app/globals.css'), 'utf8');

    expect(map).toContain('journey-mobile px-5 pb-7 pt-2 md:hidden');
    expect(map).toContain('journey-mobile-list relative flex flex-col-reverse');
    expect(map).toContain("'--journey-progress': `${journeyPct}%`");
    expect(map).toContain('Mulai dari bawah, lanjutkan perjalanan ke atas.');
    expect(map).toContain('hidden md:block');
    expect(modal).toContain('journey-modal-title');
    expect(modal).toContain('body.scrollTop = body.scrollHeight');
    expect(styles).toContain("[data-coder-modal='true'] .journey-modal-title");
    expect(styles).toContain("[data-coder-modal='true'] .journey-card-current");
    expect(styles).toContain('color: #f7fbff !important;');
  });
});
