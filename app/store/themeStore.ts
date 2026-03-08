import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';

const KEY = 'k9_theme';

interface ThemeStore {
  isDark: boolean;
  toggle: () => void;
  init: () => Promise<void>;
}

export const useThemeStore = create<ThemeStore>((set, get) => ({
  isDark: true,

  toggle: () => {
    const next = !get().isDark;
    set({ isDark: next });
    SecureStore.setItemAsync(KEY, next ? 'dark' : 'light').catch(() => {});
  },

  init: async () => {
    try {
      const stored = await SecureStore.getItemAsync(KEY);
      if (stored === 'light') set({ isDark: false });
    } catch {}
  },
}));
