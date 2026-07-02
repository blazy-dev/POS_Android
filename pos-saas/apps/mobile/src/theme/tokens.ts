export const darkColors = {
  background: '#01022e', // Fondo azul oscuro de marca
  surface: 'rgba(1, 2, 46, 0.88)', // Derivado de #01022e para contenedores
  surfaceCard: 'rgba(255, 255, 255, 0.05)',
  surfaceSoft: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.08)',
  text: '#F7FBFF',
  textMuted: '#AFBFCE',
  primary: '#0497bf', // Celeste/Cyan de marca
  success: '#01cb63', // Verde vibrante de marca
};

export const lightColors = {
  background: '#F4F7FC', // Gris-azul súper suave y limpio
  surface: '#FFFFFF', // Blanco puro para tarjetas principales
  surfaceCard: 'rgba(4, 151, 191, 0.05)', // Tarjeta con leve tinte cyan
  surfaceSoft: 'rgba(15, 30, 49, 0.05)', // Gris suave para fondos secundarios
  border: 'rgba(4, 151, 191, 0.12)', // Bordes suaves cyan/gris
  text: '#0F1E31', // Azul/gris oscuro profundo de alto contraste
  textMuted: '#687C94', // Texto secundario atenuado
  primary: '#0497bf', // Celeste/Cyan de marca
  success: '#01cb63', // Verde vibrante de marca
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
};

export const radius = {
  md: 18,
  lg: 24,
  xl: 28,
};
