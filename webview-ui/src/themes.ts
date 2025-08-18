import { DefaultTheme } from "atomize/dist/types";

// Base design tokens from the prompt
const tokens = {
  background: "#FFFFFF",
  surface: "#F7F7F7",
  divider: "#D9D9D9",

  textPrimary: "#1A1A1A",
  textSecondary: "#4D4D4D",
  textInverse: "#FFFFFF",

  primary: "#0072B2",
  onPrimary: "#FFFFFF",
  secondary: "#009E73",
  onSecondary: "#FFFFFF",
  accent: "#E69F00",
  onAccent: "#1A1A1A",

  success: "#009E73",
  onSuccess: "#FFFFFF",
  warning: "#F0E442",
  onWarning: "#1A1A1A",
  error: "#D55E00",
  onError: "#FFFFFF",
  info: "#56B4E9",
  onInfo: "#1A1A1A",

  link: "#0072B2",
  focusOutline: "#000000",
};

// Common styles for all themes
const commonThemePart = {
  fontFamily: {
    primary: "'Noto Sans JP', sans-serif",
  },
  grid: {
    containerWidth: {
      xs: "540px",
      sm: "720px",
      md: "960px",
      lg: "1140px",
      xl: "1320px",
    },
    gutterWidth: "1.5rem",
  },
};

export const lightTheme: DefaultTheme = {
  ...commonThemePart,
  colors: {
    ...tokens,
  },
};

export const darkTheme: DefaultTheme = {
  ...commonThemePart,
  colors: {
    ...tokens,
    background: "#121212",
    surface: "#1E1E1E",
    divider: "#333333",
    textPrimary: "#F5F5F5",
    textSecondary: "#A8A8A8",
    focusOutline: "#FFFFFF",
  },
};

export const warmTheme: DefaultTheme = {
  ...commonThemePart,
  colors: {
    ...tokens,
    background: "#FDF6E3", // Solarized Light background
    surface: "#F5EFDC",
    divider: "#DBCFB6",
    textPrimary: "#657B83", // Solarized Light text
    textSecondary: "#586E75",
  },
};

export type ThemeName = 'light' | 'dark' | 'warm';

export const themes: Record<ThemeName, DefaultTheme> = {
  light: lightTheme,
  dark: darkTheme,
  warm: warmTheme,
};
