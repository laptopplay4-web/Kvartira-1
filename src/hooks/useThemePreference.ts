import { useEffect, useState } from 'react';
import {
  applyThemePreference,
  getStoredThemePreference,
  type ThemePreference,
} from '@/services/theme/constants';

export function useThemePreference() {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getStoredThemePreference());

  useEffect(() => {
    applyThemePreference(preference);
  }, [preference]);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    applyThemePreference(next);
  };

  return { preference, setPreference };
};
