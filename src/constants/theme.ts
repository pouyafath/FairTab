import '@/global.css';

export const Colors = {
  light: {
    text: '#11181C',
    textSecondary: '#5F6B73',
    background: '#F6F7F8',
    card: '#FFFFFF',
    border: '#E2E6E9',
    primary: '#0F9D74',
    primaryText: '#FFFFFF',
    positive: '#0F9D74',
    negative: '#E2552D',
    danger: '#C93A2B',
  },
  dark: {
    text: '#ECEDEE',
    textSecondary: '#9BA5AC',
    background: '#0E1113',
    card: '#181C1F',
    border: '#2A3035',
    primary: '#2BC48E',
    primaryText: '#05140F',
    positive: '#2BC48E',
    negative: '#FF7A52',
    danger: '#FF6B5B',
  },
} as const;

export type ThemeColors = (typeof Colors)['light'] | (typeof Colors)['dark'];

export const Spacing = {
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
} as const;

export const Radius = 12;
export const MaxContentWidth = 720;
