import { useThemeStore } from '../store/themeStore';
import { darkColors, lightColors } from './theme';

export function useColors() {
  const isDark = useThemeStore((s) => s.isDark);
  return isDark ? darkColors : lightColors;
}
