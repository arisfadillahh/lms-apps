import { describe, expect, it } from 'vitest';
import { isCoderThemePreference, resolveCoderTheme } from '@/lib/coderTheme';

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
});
