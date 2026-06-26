import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import type { SQLiteDatabase } from "expo-sqlite";
import type { ProductRecord } from "../../database/types";
import { FormField } from "../form/FormField";
import { UnitPicker } from "./UnitPicker";
import { useBarcodeInput } from "../../hooks/useBarcodeInput";
import { findProductByBarcode, saveProduct, updateProduct } from "../../modules/products";
import { radius, spacing, ThemeColors } from "../../theme/tokens";
import { useTheme } from "../../context/ThemeContext";
import { useAuth } from "../../context/AuthContext";
import {
  calculateMargin,
  DEFAULT_PRODUCT_FORM,
  parseProductForm,
  ProductFormErrors,
  ProductFormValues,
  validateProductForm,
} from "../../utils/productValidation";

const CATEGORY_PRESETS = ["Bebidas", "Almacén", "Lácteos", "Fiambres", "Limpieza", "Otros"];

type ProductFormProps = {
  db: SQLiteDatabase;
  product?: ProductRecord; // Prop opcional para modo edición
  onSaved: () => void;
  onCancel: () => void;
};

export function ProductForm({ db, product, onSaved, onCancel }: ProductFormProps) {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const nameInputRef = useRef<TextInput>(null);

  const tenantId = user?.tenant_id || "local";

  // Inicializa el estado con los valores del producto si estamos editando, de lo contrario vacío
  const [values, setValues] = useState<ProductFormValues>(() => {
    if (product) {
      return {
        barcode: product.barcode ?? "",
        name: product.name,
        category: product.category_id ?? "",
        purchasePrice: product.purchase_price > 0 ? product.purchase_price.toString() : "",
        salePrice: product.sale_price.toString(),
        stock: product.stock.toString(),
        unit: product.unit,
      };
    }
    return DEFAULT_PRODUCT_FORM;
  });

  const [fieldErrors, setFieldErrors] = useState<ProductFormErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [barcodeStatus, setBarcodeStatus] = useState<"idle" | "checking" | "available" | "taken">(
    "idle"
  );

  const margin = useMemo(() => {
    const purchase = Number(values.purchasePrice.replace(",", "."));
    const sale = Number(values.salePrice.replace(",", "."));

    if (Number.isNaN(purchase) || Number.isNaN(sale)) {
      return null;
    }

    return calculateMargin(purchase, sale);
  }, [values.purchasePrice, values.salePrice]);

  const updateField = useCallback(
    <K extends keyof ProductFormValues>(field: K, nextValue: ProductFormValues[K]) => {
      setValues((current) => ({ ...current, [field]: nextValue }));

      if (fieldErrors[field]) {
        setFieldErrors((current) => {
          const next = { ...current };
          delete next[field];
          return next;
        });
      }

      if (field === "barcode") {
        setBarcodeStatus("idle");
      }
    },
    [fieldErrors]
  );

  const checkBarcodeAvailability = useCallback(
    async (barcode: string) => {
      const trimmed = barcode.trim();

      if (!trimmed) {
        setBarcodeStatus("idle");
        return true;
      }

      setBarcodeStatus("checking");
      const existing = await findProductByBarcode(db, trimmed, tenantId);

      if (existing) {
        // Si el producto que tiene este código es el mismo que estamos editando, se considera disponible
        if (product && existing.id === product.id) {
          setBarcodeStatus("available");
          setFieldErrors((current) => {
            if (!current.barcode) {
              return current;
            }
            const next = { ...current };
            delete next.barcode;
            return next;
          });
          return true;
        }

        setBarcodeStatus("taken");
        setFieldErrors((current) => ({
          ...current,
          barcode: "Ya existe un producto con este código de barras.",
        }));
        return false;
      }

      setBarcodeStatus("available");
      setFieldErrors((current) => {
        if (!current.barcode) {
          return current;
        }

        const next = { ...current };
        delete next.barcode;
        return next;
      });
      return true;
    },
    [db, product, tenantId]
  );

  const handleBarcodeScan = useCallback(
    async (barcode: string) => {
      updateField("barcode", barcode);
      const available = await checkBarcodeAvailability(barcode);

      if (available) {
        nameInputRef.current?.focus();
      }
    },
    [checkBarcodeAvailability, updateField]
  );

  const { handleKeyPress } = useBarcodeInput({ onScan: handleBarcodeScan });

  async function handleSubmit() {
    try {
      setSaving(true);
      setFormError(null);

      const validationErrors = validateProductForm(values);
      // En modo edición el stock no se valida porque está deshabilitado
      if (product) {
        delete validationErrors.stock;
      }
      setFieldErrors(validationErrors);

      if (Object.keys(validationErrors).length > 0) {
        return;
      }

      const barcodeAvailable = await checkBarcodeAvailability(values.barcode);
      if (!barcodeAvailable) {
        return;
      }

      const payload = parseProductForm(values);
      
      if (product) {
        // Modo edición
        await updateProduct(db, product.id, { ...payload, tenantId });
      } else {
        // Modo creación
        await saveProduct(db, { ...payload, tenantId });
      }
      onSaved();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "No se pudo guardar el producto.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Identificación</Text>
        <Text style={styles.sectionHint}>
          Escaneá con el lector USB o ingresá el código manualmente. Es opcional.
        </Text>

        <FormField
          label="Código de barras"
          value={values.barcode}
          onChangeText={(text) => updateField("barcode", text)}
          onBlur={() => {
            void checkBarcodeAvailability(values.barcode);
          }}
          onKeyPress={handleKeyPress}
          onSubmitEditing={() => {
            void handleBarcodeScan(values.barcode);
          }}
          placeholder="7791234567890"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="next"
          error={fieldErrors.barcode}
          accessory={
            barcodeStatus === "checking" ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : barcodeStatus === "available" ? (
              <Text style={styles.statusOk}>Disponible</Text>
            ) : barcodeStatus === "taken" ? (
              <Text style={styles.statusError}>En uso</Text>
            ) : null
          }
        />

        <FormField
          ref={nameInputRef}
          label="Nombre"
          required
          value={values.name}
          onChangeText={(text) => updateField("name", text)}
          placeholder="Gaseosa Cola 2.25L"
          returnKeyType="next"
          error={fieldErrors.name}
        />

        <View style={styles.categoryBlock}>
          <FormField
            label="Categoría"
            value={values.category}
            onChangeText={(text) => updateField("category", text)}
            placeholder="Bebidas"
            returnKeyType="next"
            hint="Podés elegir una sugerencia o escribir una propia."
          />

          <View style={styles.categoryGrid}>
            {CATEGORY_PRESETS.map((category) => {
              const active = values.category === category;

              return (
                <Pressable
                  key={category}
                  onPress={() => updateField("category", category)}
                  style={[styles.categoryChip, active && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, active && styles.categoryChipTextActive]}>
                    {category}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Precios</Text>

        <View style={styles.twoColumnRow}>
          <View style={styles.column}>
            <FormField
              label="Precio de compra"
              value={values.purchasePrice}
              onChangeText={(text) => updateField("purchasePrice", text)}
              placeholder="1200"
              keyboardType="decimal-pad"
              error={fieldErrors.purchasePrice}
            />
          </View>

          <View style={styles.column}>
            <FormField
              label="Precio de venta"
              required
              value={values.salePrice}
              onChangeText={(text) => updateField("salePrice", text)}
              placeholder="1800"
              keyboardType="decimal-pad"
              error={fieldErrors.salePrice}
            />
          </View>
        </View>

        {margin !== null ? (
          <View style={styles.marginCard}>
            <Text style={styles.marginLabel}>Margen estimado</Text>
            <Text style={[styles.marginValue, margin < 0 && styles.marginValueNegative]}>
              {margin.toFixed(1)}%
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Inventario</Text>

        <FormField
          label={product ? "Stock actual" : "Stock inicial"}
          value={values.stock}
          onChangeText={(text) => updateField("stock", text)}
          placeholder="10"
          keyboardType="decimal-pad"
          editable={!product}
          selectTextOnFocus={!product}
          style={product ? styles.disabledInput : null}
          hint={
            product
              ? "El stock no se puede modificar desde el catálogo. Utilizá los movimientos de inventario."
              : "Genera un movimiento de entrada automático al guardar."
          }
          error={fieldErrors.stock}
        />

        <UnitPicker value={values.unit} onChange={(unit) => updateField("unit", unit)} />
      </View>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <View style={styles.actions}>
        <Pressable style={styles.secondaryButton} onPress={onCancel} disabled={saving}>
          <Text style={styles.secondaryButtonText}>Cancelar</Text>
        </Pressable>

        <Pressable
          style={[styles.primaryButton, saving && styles.primaryButtonDisabled]}
          onPress={() => {
            void handleSubmit();
          }}
          disabled={saving}
        >
          <Text style={styles.primaryButtonText}>
            {saving ? "Guardando..." : "Guardar producto"}
          </Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  container: {
    padding: spacing.xl,
    gap: spacing.lg,
    paddingBottom: 40,
  },
  section: {
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: isDark ? "rgba(138, 199, 255, 0.14)" : colors.border,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
  },
  sectionHint: {
    color: colors.textMuted,
    fontSize: 13,
    lineHeight: 18,
    marginTop: -4,
  },
  categoryBlock: {
    gap: spacing.sm,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : colors.surfaceSoft,
  },
  categoryChipActive: {
    backgroundColor: isDark ? "rgba(138, 199, 255, 0.18)" : "rgba(4, 151, 191, 0.15)",
    borderColor: colors.primary,
  },
  categoryChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "700",
  },
  categoryChipTextActive: {
    color: isDark ? "#EAF4FF" : colors.primary,
  },
  twoColumnRow: {
    flexDirection: "row",
    gap: spacing.md,
  },
  column: {
    flex: 1,
  },
  marginCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: radius.md,
    backgroundColor: isDark ? "rgba(122, 230, 179, 0.08)" : "rgba(1, 203, 99, 0.08)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(122, 230, 179, 0.18)" : "rgba(1, 203, 99, 0.18)",
  },
  marginLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "700",
  },
  marginValue: {
    color: colors.success,
    fontSize: 18,
    fontWeight: "800",
  },
  marginValueNegative: {
    color: isDark ? "#FFB4B4" : "#D32F2F",
  },
  statusOk: {
    color: colors.success,
    fontSize: 12,
    fontWeight: "700",
  },
  statusError: {
    color: isDark ? "#FFB4B4" : "#D32F2F",
    fontSize: 12,
    fontWeight: "700",
  },
  formError: {
    color: isDark ? "#FFB4B4" : "#D32F2F",
    fontSize: 14,
    textAlign: "center",
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
  },
  primaryButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: radius.md,
    backgroundColor: isDark ? "rgba(138, 199, 255, 0.18)" : "rgba(4, 151, 191, 0.15)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(138, 199, 255, 0.22)" : "rgba(4, 151, 191, 0.35)",
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: isDark ? "#EAF4FF" : colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  secondaryButton: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: radius.md,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
  },
  secondaryButtonText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
  disabledInput: {
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.01)" : "rgba(0, 0, 0, 0.03)",
    color: colors.textMuted,
    borderColor: colors.border,
  },
});
