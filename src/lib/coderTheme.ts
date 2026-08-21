export const CODER_THEME_STORAGE_KEY = 'clevio-coder-theme';

export type CoderThemePreference = 'auto' | 'light' | 'dark';
export type CoderResolvedTheme = 'light' | 'dark';

export function isCoderThemePreference(value: string | null | undefined): value is CoderThemePreference {
  return value === 'auto' || value === 'light' || value === 'dark';
}

export function resolveCoderTheme(
  preference: CoderThemePreference,
  systemPrefersDark: boolean,
): CoderResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  return systemPrefersDark ? 'dark' : 'light';
}
