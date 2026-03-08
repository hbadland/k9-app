// ── Colour palette type ───────────────────────────────────────────────────
export type ThemeColors = typeof darkColors;

// ── Dark palette ──────────────────────────────────────────────────────────
export const darkColors = {
  dark:        '#0C0C0A',
  dark2:       '#131311',
  dark3:       '#1A1917',
  dark4:       '#222018',
  border:      'rgba(255,255,255,0.07)',
  borderMid:   'rgba(255,255,255,0.13)',

  cream:       '#F0EAD6',
  text:        '#E4DCC8',
  textDim:     '#8A8478',
  muted:       '#504D47',

  gold:        '#C9A84C',
  goldLight:   '#D4B86A',
  goldSoft:    'rgba(201,168,76,0.10)',
  goldBorder:  'rgba(201,168,76,0.25)',

  green:       '#4CAF7A',
  greenSoft:   'rgba(76,175,122,0.10)',
  red:         '#E05C5C',
  redSoft:     'rgba(224,92,92,0.10)',
  amber:       '#E8A93A',
  amberSoft:   'rgba(232,169,58,0.10)',
  blue:        '#4A80C4',
} as const;

// ── Light palette — brand: #f5f0e8 (cream) · #1c3a2b (forest green) ───────
export const lightColors: ThemeColors = {
  dark:        '#F5F0E8',
  dark2:       '#ECE8DE',
  dark3:       '#E3DDD3',
  dark4:       '#D8D1C7',
  border:      'rgba(28,58,43,0.09)',
  borderMid:   'rgba(28,58,43,0.17)',

  cream:       '#1C3A2B',
  text:        '#1C3A2B',
  textDim:     '#3D6B4F',
  muted:       '#7A9E8A',

  gold:        '#1C3A2B',
  goldLight:   '#2D5A3F',
  goldSoft:    'rgba(28,58,43,0.08)',
  goldBorder:  'rgba(28,58,43,0.22)',

  green:       '#1A6B3A',
  greenSoft:   'rgba(26,107,58,0.10)',
  red:         '#B03030',
  redSoft:     'rgba(176,48,48,0.10)',
  amber:       '#8B5E0A',
  amberSoft:   'rgba(139,94,10,0.10)',
  blue:        '#2A5CA0',
};

// Convenience re-export so existing `import { C } from './theme'` still
// works for non-component contexts that don't need reactivity.
export const C = darkColors;

// ── Typography ────────────────────────────────────────────────────────────
export const F = {
  serif: 'Georgia' as const,
} as const;
