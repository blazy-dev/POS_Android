import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { iconSize } from '../../theme/tokens';

type IconName = keyof typeof Ionicons.glyphMap;
type IconSize = keyof typeof iconSize;

interface IconProps {
  name: IconName;
  size?: IconSize;
  color?: string;
}

/**
 * Wrapper tipado sobre Ionicons con tamaños predefinidos del design system.
 */
export function Icon({ name, size = 'md', color }: IconProps) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={iconSize[size]}
      color={color ?? colors.text}
    />
  );
}
