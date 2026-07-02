import { useMemo } from 'react';
import { Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import { ProductForm } from '../components/products/ProductForm';
import type { ProductRecord } from '../database/types';
import { radius, spacing, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';

type ProductFormScreenProps = {
  product?: ProductRecord; // Prop opcional para modo edición
  onBack: () => void;
  onSaved: () => void;
};

export function ProductFormScreen({
  product,
  onBack,
  onSaved,
}: ProductFormScreenProps) {
  const db = useSQLiteContext();
  const { colors } = useTheme();
  const styles = useMemo(() => getStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>
            {product ? 'Editar producto' : 'Nuevo producto'}
          </Text>
          <Text style={styles.title}>
            {product ? 'Modificación de catálogo' : 'Alta de catálogo'}
          </Text>
        </View>
      </View>

      <ProductForm
        db={db}
        product={product}
        onCancel={onBack}
        onSaved={() => {
          onSaved();
          onBack();
        }}
      />
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      paddingHorizontal: 20,
      paddingTop: 8,
      paddingBottom: 4,
      gap: 12,
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
    },
    backButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    headerCopy: {
      gap: 4,
    },
    kicker: {
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.2,
      fontSize: 11,
      fontWeight: '700',
    },
    title: {
      color: colors.text,
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '800',
    },
  });
