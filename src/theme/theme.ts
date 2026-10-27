import { DefaultTheme, DarkTheme } from '@react-navigation/native';

export const fonts = {
  regular: 'Urbanist-Regular',
  medium: 'Urbanist-Medium',
  semiBold: 'Urbanist-SemiBold',
  bold: 'Urbanist-Bold',
  extraBold: 'Urbanist-ExtraBold',
  black: 'Urbanist-Black',
  light: 'Urbanist-Light',
  extraLight: 'Urbanist-ExtraLight',
  thin: 'Urbanist-Thin',
  italic: 'Urbanist-Italic',
  boldItalic: 'Urbanist-BoldItalic',
  semiBoldItalic: 'Urbanist-SemiBoldItalic',
  mediumItalic: 'Urbanist-MediumItalic',
} as const;

export const typography = {
  regular: { fontFamily: fonts.regular },
  medium: { fontFamily: fonts.medium },
  semiBold: { fontFamily: fonts.semiBold },
  bold: { fontFamily: fonts.bold },
  extraBold: { fontFamily: fonts.extraBold },
  black: { fontFamily: fonts.black },
  light: { fontFamily: fonts.light },
  extraLight: { fontFamily: fonts.extraLight },
  thin: { fontFamily: fonts.thin },
};

export const CustomLightTheme = {
  ...DefaultTheme,
  dark: false,
  fonts,
  typography,
  colors: {
    ...DefaultTheme.colors,
    primary: '#0B1F33', // Navy
    primaryContainer: '#E6F0FA', // Soft navy
    secondary: '#1677FF', // Electric Blue
    secondaryContainer: '#E6F4FF', // Soft electric blue
    background: '#F7F9FC', // White/Off-white background (with ice blue tint)
    card: '#FFFFFF', // Pure White
    text: '#0B1F33', // Navy text
    border: '#E1E6EB', // Soft border
    notification: '#EF4444',
    error: '#EF4444',
    success: '#10B981',
    warning: '#F59E0B',
    placeholder: '#647890', // Muted blue-gray placeholder
    accent: '#1677FF', // Electric Blue accent
  },
};

export const CustomDarkTheme = {
  ...DarkTheme,
  dark: true,
  fonts,
  typography,
  colors: {
    ...DarkTheme.colors,
    primary: '#0B1F33', // Navy (Navy bg for buttons in dark mode)
    primaryContainer: '#002A66', // Deep electric blue
    secondary: '#1677FF', // Electric Blue
    secondaryContainer: '#1E354A', // Deep navy secondary container
    background: '#0B1F33', // Navy background
    card: '#122A40', // Lighter navy card
    text: '#F7F9FC', // Off-white text
    border: '#1A3750', // Navy dark border
    notification: '#F87171',
    error: '#F87171',
    success: '#34D399',
    warning: '#FBBF24',
    placeholder: '#7D90A6',
    accent: '#1677FF', // Electric Blue accent
  },
};

export type AppTheme = typeof CustomLightTheme;
