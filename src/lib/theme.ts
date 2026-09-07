import { useColorScheme } from 'react-native';

// Huddle Up visual system.
// Ground: cool chalk white with a green bias (light) / night-game green-black (dark).
// Accent: turf green. Signal: cone orange, used only for "needs a ride" and warnings.
// Type: Barlow Condensed for display, Barlow for everything else.

export interface Palette {
  bg: string; surface: string; surfaceAlt: string; ink: string; muted: string; line: string;
  accent: string; accentInk: string; accentSoft: string; signal: string; signalSoft: string;
  gold: string; goldSoft: string; danger: string;
}

export const palette: { light: Palette; dark: Palette } = {
  light: {
    bg: '#F3F5F4',
    surface: '#FFFFFF',
    surfaceAlt: '#E9EEEB',
    ink: '#1B2430',
    muted: '#5F6E66',
    line: '#D5DCD8',
    accent: '#1F7A4D',
    accentInk: '#FFFFFF',
    accentSoft: '#E3F0E8',
    signal: '#C8532B',
    signalSoft: '#F8E8E1',
    gold: '#8A6D1F',
    goldSoft: '#F5EDD6',
    danger: '#B3261E',
  },
  dark: {
    bg: '#121A16',
    surface: '#1B2621',
    surfaceAlt: '#22302A',
    ink: '#E6ECE8',
    muted: '#9BAAA2',
    line: '#2E3C35',
    accent: '#5CC08A',
    accentInk: '#0E1A13',
    accentSoft: '#1D3328',
    signal: '#E8825C',
    signalSoft: '#3A241B',
    gold: '#D6B255',
    goldSoft: '#332C18',
    danger: '#F2857A',
  },
};

export const fonts = {
  display: 'BarlowCondensed_700Bold',
  displayMedium: 'BarlowCondensed_600SemiBold',
  body: 'Barlow_400Regular',
  bodyMedium: 'Barlow_500Medium',
  bodyBold: 'Barlow_600SemiBold',
} as const;

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export const radius = { sm: 6, md: 10, lg: 14, pill: 999 } as const;

export function useTheme(): Palette {
  const scheme = useColorScheme();
  return scheme === 'dark' ? palette.dark : palette.light;
}

export const sportLabel: Record<string, string> = {
  soccer: 'Soccer',
  basketball: 'Basketball',
  other: 'Sport',
};

export const teamColors = ['#1F7A4D', '#1D4ED8', '#B91C1C', '#7C3AED', '#0F766E', '#C2410C', '#4B5563', '#A16207'];
