import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import type { InventoryMovementRecord, ProductRecord } from '../database/types';
import { listInventoryMovements } from '../database';
import { adjustStock } from '../modules/products';
import { FormField } from '../components/form/FormField';
import { radius, spacing, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';

type StockAdjustmentScreenProps = {
  product: ProductRecord;
  onBack: () => void;
  onSaved: () => void;
};

export function StockAdjustmentScreen({
  product,
  onBack,
  onSaved,
}: StockAdjustmentScreenProps) {
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [movements, setMovements] = useState<InventoryMovementRecord[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(true);

  // Estados del formulario de ajuste
  const [adjustmentType, setAdjustmentType] = useState<'in' | 'out'>('in');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Compra/Reposición');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Carga los movimientos históricos del producto
  async function refreshMovements() {
    try {
      setLoadingMovements(true);
      const rows = await listInventoryMovements(db, product.id);
      setMovements(rows);
    } catch (err) {
      console.error('Error al cargar movimientos:', err);
    } finally {
      setLoadingMovements(false);
    }
  }

  useEffect(() => {
    void refreshMovements();
  }, [db, product.id]);

  // Formatea la fecha de ISO 8601 a un formato legible
  function formatDate(isoString: string) {
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return isoString;
    }
  }

  // Mapea los tipos de referencias a etiquetas legibles
  function formatReference(type: string, id: string) {
    switch (type) {
      case 'product':
        return 'Stock Inicial';
      case 'sale':
        return `Venta (Ref: ${id.substring(0, 8)})`;
      case 'adjustment':
        return 'Ajuste Manual';
      default:
        return type;
    }
  }

  async function handleSaveAdjustment() {
    setErrorMsg(null);
    const parsedQty = parseFloat(quantity.replace(',', '.'));

    if (Number.isNaN(parsedQty) || parsedQty <= 0) {
      setErrorMsg('Ingresá una cantidad válida mayor a cero.');
      return;
    }

    const trimmedReason = reason.trim() || (adjustmentType === 'in' ? 'Compra/Reposición' : 'Ajuste manual');

    if (adjustmentType === 'out' && product.stock < parsedQty) {
      setErrorMsg(`No hay suficiente stock. Stock actual: ${product.stock}`);
      return;
    }

    try {
      setSaving(true);
      await adjustStock(
        db,
        product.id,
        adjustmentType,
        parsedQty,
        trimmedReason,
        product.tenant_id,
      );
      onSaved();
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Ocurrió un error al registrar el ajuste.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </Pressable>

        <View style={styles.headerCopy}>
          <Text style={styles.kicker}>Inventario</Text>
          <Text style={styles.title}>Ajuste de Stock</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Ficha del Producto */}
        <View style={styles.productCard}>
          <Text style={styles.productName}>{product.name}</Text>
          <Text style={styles.productBarcode}>
            {product.barcode
              ? `Código: ${product.barcode}`
              : 'Sin código de barras'}
          </Text>
          <View style={styles.stockBadgeContainer}>
            <Text style={styles.stockLabel}>Stock actual:</Text>
            <Text style={styles.stockValue}>
              {product.stock} {product.unit}
            </Text>
          </View>
        </View>

        {/* Sección Formulario de Ajuste */}
        <View style={styles.formSection}>
          <Text style={styles.sectionTitle}>Registrar Ajuste Manual</Text>

          {/* Selector de Tipo (Entrada/Salida) */}
          <Text style={styles.inputLabel}>Tipo de movimiento</Text>
          <View style={styles.typeSelectorRow}>
            <Pressable
              style={[
                styles.typeButton,
                styles.typeInButton,
                adjustmentType === 'in' && styles.typeInActive,
              ]}
              onPress={() => {
                setAdjustmentType('in');
                setReason('Compra/Reposición');
              }}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  styles.typeInText,
                  adjustmentType === 'in' && styles.typeTextActive,
                ]}
              >
                Entrada (+)
              </Text>
            </Pressable>

            <Pressable
              style={[
                styles.typeButton,
                styles.typeOutButton,
                adjustmentType === 'out' && styles.typeOutActive,
              ]}
              onPress={() => {
                setAdjustmentType('out');
                setReason('Ajuste manual');
              }}
            >
              <Text
                style={[
                  styles.typeButtonText,
                  styles.typeOutText,
                  adjustmentType === 'out' && styles.typeTextActive,
                ]}
              >
                Salida (-)
              </Text>
            </Pressable>
          </View>

          {/* Input Cantidad */}
          <FormField
            label="Cantidad a ajustar"
            value={quantity}
            onChangeText={setQuantity}
            placeholder="10"
            keyboardType="decimal-pad"
            required
          />

          {/* Selector de Chips de Motivo */}
          <Text style={[styles.inputLabel, { marginBottom: 8 }]}>Motivo del ajuste</Text>
          <View style={styles.reasonsRow}>
            {['Ajuste manual', 'Rotura/Pérdida', 'Compra/Reposición'].map(
              (presetReason) => {
                const isSelected = reason === presetReason;
                return (
                  <Pressable
                    key={presetReason}
                    onPress={() => setReason(presetReason)}
                    style={[styles.reasonChip, isSelected && styles.reasonChipActive]}
                  >
                    <Text style={[styles.reasonChipText, isSelected && styles.reasonChipTextActive]}>
                      {presetReason}
                    </Text>
                  </Pressable>
                );
              }
            )}
          </View>

          {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

          {/* Acciones */}
          <View style={styles.formActions}>
            <Pressable
              style={[styles.saveButton, saving && styles.buttonDisabled]}
              onPress={() => {
                void handleSaveAdjustment();
              }}
              disabled={saving}
            >
              <Text style={styles.saveButtonText}>
                {saving ? 'Guardando...' : 'Guardar Ajuste'}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Listado de Historial de Movimientos */}
        <View style={styles.historySection}>
          <Text style={styles.sectionTitle}>Historial de Movimientos</Text>

          {loadingMovements ? (
            <ActivityIndicator
              size="small"
              color={colors.primary}
              style={{ marginVertical: 20 }}
            />
          ) : movements.length === 0 ? (
            <Text style={styles.emptyHistoryText}>
              No hay movimientos registrados para este producto.
            </Text>
          ) : (
            movements.map((item) => {
              const isIn = item.movement_type === 'in';
              return (
                <View key={item.id} style={styles.movementRow}>
                  <View style={styles.movementMeta}>
                    <Text style={styles.movementDate}>
                      {formatDate(item.created_at)}
                    </Text>
                    <Text style={styles.movementRef}>
                      {formatReference(item.reference_type, item.reference_id)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.movementQtyBadge,
                      isIn ? styles.qtyInBadge : styles.qtyOutBadge,
                    ]}
                  >
                    <Text
                      style={[
                        styles.movementQtyText,
                        isIn ? styles.qtyInText : styles.qtyOutText,
                      ]}
                    >
                      {isIn ? '+' : '-'}
                      {item.quantity}
                    </Text>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
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
    container: {
      padding: spacing.xl,
      gap: spacing.lg,
      paddingBottom: 130,
    },
    productCard: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: isDark ? 'rgba(138, 199, 255, 0.08)' : colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 6,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    productName: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    productBarcode: {
      color: colors.textMuted,
      fontSize: 13,
    },
    stockBadgeContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 6,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    stockLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    stockValue: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    formSection: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    sectionTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    inputLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: -4,
    },
    typeSelectorRow: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    typeButton: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    typeInButton: {
      borderColor: isDark
        ? 'rgba(122, 230, 179, 0.2)'
        : 'rgba(1, 203, 99, 0.2)',
      backgroundColor: isDark
        ? 'rgba(122, 230, 179, 0.04)'
        : 'rgba(1, 203, 99, 0.04)',
    },
    typeOutButton: {
      borderColor: isDark
        ? 'rgba(255, 180, 180, 0.2)'
        : 'rgba(211, 47, 47, 0.2)',
      backgroundColor: isDark
        ? 'rgba(255, 180, 180, 0.04)'
        : 'rgba(211, 47, 47, 0.04)',
    },
    typeInActive: {
      backgroundColor: isDark
        ? 'rgba(122, 230, 179, 0.16)'
        : 'rgba(1, 203, 99, 0.16)',
      borderColor: colors.success,
    },
    typeOutActive: {
      backgroundColor: isDark
        ? 'rgba(255, 180, 180, 0.16)'
        : 'rgba(211, 47, 47, 0.16)',
      borderColor: isDark ? '#FFB4B4' : '#D32F2F',
    },
    typeButtonText: {
      fontSize: 14,
      fontWeight: '700',
    },
    typeInText: {
      color: colors.success,
    },
    typeOutText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
    },
    typeTextActive: {
      color: isDark ? '#FFFFFF' : colors.text,
      fontWeight: '800',
    },
    reasonsRow: {
      flexDirection: 'row',
      gap: spacing.sm,
      marginTop: -4,
    },
    reasonChip: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 2,
      paddingVertical: 8,
      borderRadius: radius.md,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.04)'
        : colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    reasonChipActive: {
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.12)'
        : 'rgba(4, 151, 191, 0.08)',
      borderColor: colors.primary,
    },
    reasonChipText: {
      color: colors.textMuted,
      fontSize: 10.5,
      fontWeight: '700',
      textAlign: 'center',
    },
    reasonChipTextActive: {
      color: colors.primary,
    },
    errorText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 13,
      textAlign: 'center',
    },
    formActions: {
      marginTop: 4,
    },
    saveButton: {
      width: '100%',
      paddingVertical: 14,
      borderRadius: radius.md,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.18)'
        : 'rgba(4, 151, 191, 0.15)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(138, 199, 255, 0.22)'
        : 'rgba(4, 151, 191, 0.35)',
      alignItems: 'center',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    saveButtonText: {
      color: isDark ? '#EAF4FF' : colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    historySection: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    emptyHistoryText: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      paddingVertical: 12,
    },
    movementRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    movementMeta: {
      gap: 4,
    },
    movementDate: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    movementRef: {
      color: colors.textMuted,
      fontSize: 11,
    },
    movementQtyBadge: {
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: radius.md,
      minWidth: 46,
      alignItems: 'center',
    },
    qtyInBadge: {
      backgroundColor: isDark
        ? 'rgba(122, 230, 179, 0.12)'
        : 'rgba(1, 203, 99, 0.08)',
    },
    qtyOutBadge: {
      backgroundColor: isDark
        ? 'rgba(255, 180, 180, 0.12)'
        : 'rgba(211, 47, 47, 0.08)',
    },
    movementQtyText: {
      fontSize: 13,
      fontWeight: '800',
    },
    qtyInText: {
      color: colors.success,
    },
    qtyOutText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
    },
  });
