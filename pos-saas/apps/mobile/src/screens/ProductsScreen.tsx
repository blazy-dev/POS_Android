import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSQLiteContext } from "expo-sqlite";
import type { ProductRecord } from "../database/types";
import { findProductByBarcode, listProducts, deleteProduct } from "../modules/products";
import { ProductFormScreen } from "./ProductFormScreen";
import { StockAdjustmentScreen } from "./StockAdjustmentScreen";
import { radius, spacing, ThemeColors } from "../theme/tokens";
import { useTheme } from "../context/ThemeContext";

type ProductsView = "list" | "form" | "adjust";

export function ProductsScreen() {
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [view, setView] = useState<ProductsView>("list");
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  
  // Estado para rastrear el producto seleccionado
  const [selectedProduct, setSelectedProduct] = useState<ProductRecord | undefined>(undefined);
  // Estado para controlar la visibilidad del menú de opciones rápidas
  const [actionMenuVisible, setActionMenuVisible] = useState(false);

  async function refreshProducts() {
    const rows = await listProducts(db);
    setProducts(rows);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        await refreshProducts();
        if (mounted) {
          setErrorMessage(null);
        }
      } catch (error) {
        if (mounted) {
          setErrorMessage(error instanceof Error ? error.message : "No se pudieron cargar productos.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [db]);

  async function handleBarcodeSearch(barcode: string) {
    const trimmed = barcode.trim();
    setSearchQuery(trimmed);

    if (!trimmed) {
      setSearchMessage(null);
      return;
    }

    const product = await findProductByBarcode(db, trimmed);

    if (!product) {
      setSearchMessage(`No se encontró ningún producto con el código ${trimmed}.`);
      return;
    }

    setSearchMessage(`Encontrado: ${product.name}`);
  }

  const handleDeleteProduct = (product: ProductRecord) => {
    Alert.alert(
      "Eliminar Producto",
      `¿Estás seguro de que deseas eliminar "${product.name}"? Esta acción quitará el producto del catálogo.`,
      [
        {
          text: "Cancelar",
          style: "cancel",
        },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              setActionMenuVisible(false);
              await deleteProduct(db, product.id);
              await refreshProducts();
            } catch (err) {
              console.error(err);
              Alert.alert("Error", "No se pudo eliminar el producto.");
            }
          },
        },
      ]
    );
  };

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return (
      product.name.toLowerCase().includes(query) ||
      (product.barcode?.toLowerCase().includes(query) ?? false)
    );
  });

  if (view === "form") {
    return (
      <ProductFormScreen
        product={selectedProduct}
        onBack={() => {
          setSelectedProduct(undefined);
          setView("list");
        }}
        onSaved={() => {
          void refreshProducts();
        }}
      />
    );
  }

  if (view === "adjust" && selectedProduct) {
    return (
      <StockAdjustmentScreen
        product={selectedProduct}
        onBack={() => {
          setSelectedProduct(undefined);
          setView("list");
        }}
        onSaved={() => {
          setSelectedProduct(undefined);
          void refreshProducts();
        }}
      />
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.kicker}>Productos</Text>
        <Text style={styles.title}>Catálogo local</Text>
        <Text style={styles.subtitle}>
          Consultá, buscá por código de barras o cargá nuevos productos.
        </Text>

        <Pressable
          style={styles.primaryButton}
          onPress={() => {
            setSelectedProduct(undefined);
            setView("form");
          }}
        >
          <Text style={styles.primaryButtonText}>+ Nuevo producto</Text>
        </Pressable>

        <View style={styles.searchCard}>
          <Text style={styles.cardTitle}>Buscar por código o nombre</Text>
          <TextInput
            value={searchQuery}
            onChangeText={(value) => {
              setSearchQuery(value);
              setSearchMessage(null);
            }}
            onSubmitEditing={() => {
              void handleBarcodeSearch(searchQuery);
            }}
            placeholder="Escaneá o escribí el código de barras"
            placeholderTextColor="#708090"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchMessage ? (
            <Text
              style={[
                styles.searchMessage,
                searchMessage.startsWith("Encontrado") ? styles.searchMessageOk : styles.searchMessageError,
              ]}
            >
              {searchMessage}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {searchQuery.trim() ? "Resultados" : "Todos los productos"} ({filteredProducts.length})
          </Text>

          {loading ? (
            <Text style={styles.cardText}>Cargando productos...</Text>
          ) : errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : filteredProducts.length === 0 ? (
            <Text style={styles.cardText}>
              {searchQuery.trim()
                ? "No hay productos que coincidan con la búsqueda."
                : "Todavía no hay productos. Creá el primero con el botón de arriba."}
            </Text>
          ) : (
            filteredProducts.map((product) => (
              <Pressable
                key={product.id}
                style={({ pressed }) => [
                  styles.productRow,
                  pressed && styles.productRowPressed,
                ]}
                onPress={() => {
                  setSelectedProduct(product);
                  setActionMenuVisible(true);
                }}
              >
                <View style={styles.productInfo}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>
                    {product.barcode ?? "Sin código"} · Stock {product.stock} · {product.unit}
                  </Text>
                </View>
                <View style={styles.priceContainer}>
                  <Text style={styles.productPrice}>$ {product.sale_price.toFixed(2)}</Text>
                  <Text style={styles.editIndicator}>Gestionar →</Text>
                </View>
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      {/* Menú de opciones rápidas al seleccionar un producto */}
      <Modal
        visible={actionMenuVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setActionMenuVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setActionMenuVisible(false)}
        >
          <View style={styles.menuContainer}>
            <Text style={styles.menuTitle}>{selectedProduct?.name}</Text>
            <Text style={styles.menuSubtitle}>
              {selectedProduct?.barcode ?? "Sin código"} · Stock: {selectedProduct?.stock} {selectedProduct?.unit}
            </Text>

            <Pressable
              style={styles.menuOption}
              onPress={() => {
                setActionMenuVisible(false);
                setView("form");
              }}
            >
              <Text style={styles.menuOptionText}>Editar Ficha Comercial</Text>
              <Text style={styles.menuOptionSub}>Modificar nombre, precios, código o categoría</Text>
            </Pressable>

            <Pressable
              style={[styles.menuOption, styles.menuOptionBorder]}
              onPress={() => {
                setActionMenuVisible(false);
                setView("adjust");
              }}
            >
              <Text style={styles.menuOptionText}>Ajustar Stock / Historial</Text>
              <Text style={styles.menuOptionSub}>Registrar entrada/salida y ver movimientos</Text>
            </Pressable>

            <Pressable
              style={[styles.menuOption, styles.menuOptionBorder]}
              onPress={() => {
                if (selectedProduct) {
                  handleDeleteProduct(selectedProduct);
                }
              }}
            >
              <Text style={[styles.menuOptionText, { color: "#ff4d4d" }]}>Eliminar Producto</Text>
              <Text style={styles.menuOptionSub}>Quitar el producto del catálogo local y del servidor</Text>
            </Pressable>

            <Pressable
              style={styles.menuCancelButton}
              onPress={() => setActionMenuVisible(false)}
            >
              <Text style={styles.menuCancelText}>Cancelar</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    padding: spacing.xl,
    gap: spacing.md,
  },
  kicker: {
    color: colors.primary,
    textTransform: "uppercase",
    letterSpacing: 1.4,
    fontSize: 12,
    fontWeight: "700",
  },
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "800",
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 21,
  },
  primaryButton: {
    marginTop: spacing.sm,
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: isDark ? "rgba(138, 199, 255, 0.18)" : "rgba(4, 151, 191, 0.15)",
    borderWidth: 1,
    borderColor: isDark ? "rgba(138, 199, 255, 0.22)" : "rgba(4, 151, 191, 0.35)",
    alignItems: "center",
  },
  primaryButtonText: {
    color: isDark ? "#EAF4FF" : colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  searchCard: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...(!isDark && {
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    }),
  },
  searchInput: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : colors.surface,
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  searchMessage: {
    fontSize: 13,
    lineHeight: 18,
  },
  searchMessageOk: {
    color: colors.success,
  },
  searchMessageError: {
    color: isDark ? "#FFB4B4" : "#D32F2F",
  },
  card: {
    marginTop: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    ...(!isDark && {
      shadowColor: "#000",
      shadowOpacity: 0.04,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    }),
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 4,
  },
  cardText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  errorText: {
    color: isDark ? "#FFB4B4" : "#D32F2F",
    fontSize: 14,
  },
  productRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  productRowPressed: {
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : "rgba(0, 0, 0, 0.02)",
  },
  productInfo: {
    flex: 1,
    gap: 4,
  },
  productName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
  },
  productMeta: {
    color: colors.textMuted,
    fontSize: 12,
  },
  productPrice: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  priceContainer: {
    alignItems: "flex-end",
    gap: 2,
  },
  editIndicator: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "flex-end",
  },
  menuContainer: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
    gap: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
  },
  menuSubtitle: {
    color: colors.textMuted,
    fontSize: 13,
    marginTop: -8,
    marginBottom: 8,
  },
  menuOption: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.02)" : colors.surfaceSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  menuOptionBorder: {
    borderColor: colors.primary,
    backgroundColor: isDark ? "rgba(138, 199, 255, 0.02)" : "rgba(4, 151, 191, 0.05)",
  },
  menuOptionText: {
    color: isDark ? "#EAF4FF" : colors.primary,
    fontSize: 15,
    fontWeight: "700",
  },
  menuOptionSub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  menuCancelButton: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: isDark ? "rgba(255, 255, 255, 0.04)" : colors.surfaceSoft,
    alignItems: "center",
  },
  menuCancelText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700",
  },
});
