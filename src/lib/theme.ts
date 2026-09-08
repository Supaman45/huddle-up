// Huddle Up visual system · "Evening field" (direction A1, chosen 2026-09-08)
// Ground: slate navy. Actions: soft sage. Anything that needs you: warm apricot.
// Kid colors are the only saturated hues on screen so a parent's eye finds their kid first.
// Type: Barlow Condensed for display, Barlow for text, JetBrains Mono for times and scores.
// The app is dark by default. Light mode arrives with Release 1 once the tokens settle.

export interface Palette {
  bg: string;
  surface: string;
  surfaceAlt: string;
  surfaceRaised: string;
  ink: string;
  inkStrong: string;
  muted: string;
  faint: string;
  line: string;
  lineStrong: string;
  accent: string;
  accentInk: string;
  accentSoft: string;
  signal: string;
  signalSoft: string;
  gold: string;
  goldSoft: string;
  danger: string;
  glow: string;
}

export const palette: Palette = {
  bg: '#0F1620',
  surface: '#141D2B',
  surfaceAlt: '#1B2635',
  surfaceRaised: '#1F2C3D',
  ink: '#EEF2F6',
  inkStrong: '#F7F9FB',
  muted: '#A3AFBC',
  faint: '#6F7C8A',
  line: '#26313F',
  lineStrong: '#2B3848',
  accent: '#8CD5A5',
  accentInk: '#0E1A14',
  accentSoft: 'rgba(140,213,165,0.14)',
  signal: '#F3A56B',
  signalSoft: 'rgba(243,165,107,0.16)',
  gold: '#F5B849',
  goldSoft: 'rgba(245,184,73,0.16)',
  danger: '#F28B82',
  glow: 'rgba(140,213,165,0.22)',
};

export const fonts = {
  display: 'BarlowCondensed_800ExtraBold',
  displayBold: 'BarlowCondensed_700Bold',
  displayMedium: 'BarlowCondensed_600SemiBold',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodyBold: 'Barlow_600SemiBold',
  mono: 'JetBrainsMono_500Medium',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 22, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;

export function useTheme(): Palette {
  return palette;
}

export const sportLabel: Record<string, string> = {
  soccer: 'Soccer',
  basketball: 'Basketball',
  other: 'Sport',
};

// Kid and team colors: bright enough to glow on the slate ground, distinct from the sage action color.
export const teamColors = ['#F5B849', '#6FA8FF', '#FF8A5B', '#C08BFF', '#5FD3C0', '#FF7F9E', '#9BD65C', '#F0F0F0'];
