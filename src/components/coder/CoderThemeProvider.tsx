'use client';

import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  CODER_THEME_STORAGE_KEY,
  isCoderThemePreference,
  resolveCoderTheme,
  type CoderResolvedTheme,
  type CoderThemePreference,
} from '@/lib/coderTheme';

type CoderThemeContextValue = {
  preference: CoderThemePreference;
  resolvedTheme: CoderResolvedTheme;
  setPreference: (preference: CoderThemePreference) => void;
};

const CoderThemeContext = createContext<CoderThemeContextValue | null>(null);

function readPreference(): CoderThemePreference {
  if (typeof window === 'undefined') return 'auto';
  try {
    const stored = window.localStorage.getItem(CODER_THEME_STORAGE_KEY);
    return isCoderThemePreference(stored) ? stored : 'auto';
  } catch {
    return 'auto';
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export default function CoderThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreferenceState] = useState<CoderThemePreference>('auto');
  const [resolvedTheme, setResolvedTheme] = useState<CoderResolvedTheme>('light');

  const applyTheme = (nextPreference: CoderThemePreference) => {
    const nextTheme = resolveCoderTheme(nextPreference, systemPrefersDark());
    document.documentElement.dataset.coderTheme = nextTheme;
    setResolvedTheme(nextTheme);
  };

  useLayoutEffect(() => {
    const initialPreference = readPreference();
    setPreferenceState(initialPreference);
    applyTheme(initialPreference);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = () => {
      if (preference === 'auto') applyTheme('auto');
    };

    if (mediaQuery.addEventListener) {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }

    mediaQuery.addListener?.(handleSystemThemeChange);
    return () => mediaQuery.removeListener?.(handleSystemThemeChange);
  }, [preference]);

  const setPreference = (nextPreference: CoderThemePreference) => {
    try {
      window.localStorage.setItem(CODER_THEME_STORAGE_KEY, nextPreference);
    } catch {
      // Keep the selection active for this session when storage is unavailable.
    }
    setPreferenceState(nextPreference);
    applyTheme(nextPreference);
  };

  const value = useMemo(
    () => ({ preference, resolvedTheme, setPreference }),
    [preference, resolvedTheme],
  );

  return <CoderThemeContext.Provider value={value}>{children}</CoderThemeContext.Provider>;
}

export function useCoderTheme() {
  const context = useContext(CoderThemeContext);
  if (!context) throw new Error('useCoderTheme must be used within CoderThemeProvider');
  return context;
}
