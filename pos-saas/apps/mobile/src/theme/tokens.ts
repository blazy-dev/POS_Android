export const darkColors = {
  background: '#0b0f19', // Slate Muted Navy
  surface: '#171e2e', // Superficie pizarra oscura
  surfaceCard: '#171e2e',
  surfaceSoft: '#1e293b', // slate-800
  border: '#293548', // Borde pizarra
  text: '#f8fafc', // slate-50 (Blanco suave de alto contraste)
  textMuted: '#94a3b8', // slate-400
  primary: '#0497bf', // Celeste/Cyan original de la app
  primarySoft: 'rgba(4, 151, 191, 0.08)',
  primaryBorder: 'rgba(4, 151, 191, 0.18)',
  success: '#01cb63', // Verde original de la app
  successSoft: 'rgba(1, 203, 99, 0.1)',
  successBorder: 'rgba(1, 203, 99, 0.2)',
  warning: '#fbbf24', // amber-400
  warningSoft: 'rgba(251, 191, 36, 0.1)',
  warningBorder: 'rgba(251, 191, 36, 0.2)',
  danger: '#f87171', // red-400
  dangerSoft: 'rgba(248, 113, 113, 0.1)',
  dangerBorder: 'rgba(248, 113, 113, 0.2)',
  info: '#60a5fa', // blue-400
  infoSoft: 'rgba(96, 165, 250, 0.1)',
  infoBorder: 'rgba(96, 165, 250, 0.2)',
};

export const lightColors = {
  background: '#F4F7FC', // Gris-azul suave y limpio original
  surface: '#FFFFFF',
  surfaceCard: '#FFFFFF',
  surfaceSoft: 'rgba(15, 30, 49, 0.05)',
  border: 'rgba(4, 151, 191, 0.12)',
  text: '#0F1E31',
  textMuted: '#687C94',
  primary: '#0497bf', // Celeste/Cyan original de la app
  primarySoft: 'rgba(4, 151, 191, 0.08)',
  primaryBorder: 'rgba(4, 151, 191, 0.18)',
  success: '#01cb63', // Verde original de la app
  successSoft: 'rgba(1, 203, 99, 0.06)',
  successBorder: 'rgba(1, 203, 99, 0.15)',
  warning: '#E67E22',
  warningSoft: 'rgba(230, 126, 34, 0.06)',
  warningBorder: 'rgba(230, 126, 34, 0.15)',
  danger: '#D32F2F',
  dangerSoft: 'rgba(211, 47, 47, 0.06)',
  dangerBorder: 'rgba(211, 47, 47, 0.15)',
  info: '#2196F3',
  infoSoft: 'rgba(33, 150, 243, 0.06)',
  infoBorder: 'rgba(33, 150, 243, 0.15)',
};

export type ThemeColors = typeof darkColors;

// Export a default fallback colors object for simple static imports if needed (temporarily or fallback)
export const colors = darkColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 28,
  '3xl': 36,
};

export const radius = {
  sm: 8, // Esquinas redondeadas estilo Shadcn UI
  md: 12,
  lg: 16,
  xl: 20,
  full: 999,
};

export const fontSize = {
  xs: 11,
  sm: 12,
  md: 13,
  base: 14,
  lg: 16,
  xl: 18,
  '2xl': 22,
  '3xl': 28,
  '4xl': 34,
};

export const fontWeight = {
  normal: '400' as const,
  medium: '500' as const,
  semibold: '600' as const,
  bold: '700' as const,
  extrabold: '800' as const,
};

export const shadow = {
  sm: {
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 5,
  },
};

export const iconSize = {
  sm: 16,
  md: 20,
  lg: 24,
  xl: 28,
  '2xl': 32,
};
