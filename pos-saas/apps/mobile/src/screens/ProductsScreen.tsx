import { useEffect, useMemo, useState } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ProductRecord } from '../database/types';
import {
  findProductByBarcode,
  listProducts,
  deleteProduct,
} from '../modules/products';
import { ProductFormScreen } from './ProductFormScreen';
import { StockAdjustmentScreen } from './StockAdjustmentScreen';
import { LabelPrintingScreen } from './LabelPrintingScreen';
import { radius, spacing, fontSize, fontWeight, shadow, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { Badge } from '../components/ui/Badge';

type ProductsView = 'list' | 'form' | 'adjust' | 'labels';

export function ProductsScreen() {
  const db = useSQLiteContext();
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const isCashier = user?.role === 'cashier';
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);
  const [view, setView] = useState<ProductsView>('list');
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const PAGE_SIZE = 10;

  // Estado para rastrear el producto seleccionado
  const [selectedProduct, setSelectedProduct] = useState<
    ProductRecord | undefined
  >(undefined);
  // Estado para controlar la visibilidad del menú de opciones rápidas
  const [actionMenuVisible, setActionMenuVisible] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const tenantId = user?.tenant_id || 'local';

  // Genera y comparte el PDF del catálogo completo de productos
  const handleExportProductsPDF = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      if (products.length === 0) {
        Alert.alert('Aviso', 'No hay productos en el catálogo para exportar.');
        setIsExporting(false);
        return;
      }

      const currentDate = new Date().toLocaleString();
      const rowsHtml = products
        .map(
          (p) => `
        <tr>
          <td>${p.barcode || '—'}</td>
          <td>${p.name}</td>
          <td style="text-align: right;">${p.stock} ${p.unit}</td>
          <td style="text-align: right;">$ ${p.sale_price.toFixed(2)}</td>
        </tr>
      `
        )
        .join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 40px;
              color: #18181b;
            }
            h1 {
              font-size: 24px;
              font-weight: 800;
              margin-bottom: 4px;
              letter-spacing: -0.5px;
            }
            p {
              font-size: 13px;
              color: #71717a;
              margin-top: 0;
              margin-bottom: 24px;
            }
            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 10px;
            }
            th {
              background-color: #f4f4f5;
              color: #27272a;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              text-align: left;
              padding: 8px 12px;
              border-bottom: 2px solid #e4e4e7;
            }
            td {
              font-size: 12px;
              padding: 10px 12px;
              border-bottom: 1px solid #e4e4e7;
            }
            tr:nth-child(even) {
              background-color: #fafafa;
            }
            tr {
              page-break-inside: avoid;
            }
          </style>
        </head>
        <body>
          <h1>Catálogo de Productos</h1>
          <p>Generado localmente el ${currentDate} · Total: ${products.length} productos</p>
          <table>
            <thead>
              <tr>
                <th style="width: 25%;">Código</th>
                <th style="width: 45%;">Nombre</th>
                <th style="width: 15%; text-align: right;">Stock</th>
                <th style="width: 15%; text-align: right;">Precio</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Exportar catálogo de productos',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Ocurrió un error al generar o compartir el PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  async function refreshProducts() {
    const rows = await listProducts(db, tenantId);
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
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar productos.',
          );
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
  }, [db, tenantId]);

  async function handleBarcodeSearch(barcode: string) {
    const trimmed = barcode.trim();
    setSearchQuery(trimmed);

    if (!trimmed) {
      setSearchMessage(null);
      return;
    }

    const product = await findProductByBarcode(db, trimmed, tenantId);

    if (!product) {
      setSearchMessage(
        `No se encontró ningún producto con el código ${trimmed}.`,
      );
      return;
    }

    setSearchMessage(`Encontrado: ${product.name}`);
  }

  const handleDeleteProduct = (product: ProductRecord) => {
    Alert.alert(
      'Eliminar Producto',
      `¿Estás seguro de que deseas eliminar "${product.name}"? Esta acción quitará el producto del catálogo.`,
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Eliminar',
          style: 'destructive',
          onPress: async () => {
            try {
              setActionMenuVisible(false);
              await deleteProduct(db, product.id, tenantId);
              await refreshProducts();
            } catch (err) {
              console.error(err);
              Alert.alert('Error', 'No se pudo eliminar el producto.');
            }
          },
        },
      ],
    );
  };

  const filteredProducts = products.filter((product) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      product.name.toLowerCase().includes(query) ||
      (product.barcode?.toLowerCase().includes(query) ?? false)
    );
  });

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE) || 1;
  
  // Asegurar que la página actual no quede huérfana si los productos cambian
  const activePage = Math.min(currentPage, totalPages);

  const startIndex = (activePage - 1) * PAGE_SIZE;
  const endIndex = startIndex + PAGE_SIZE;
  const visibleProducts = filteredProducts.slice(startIndex, endIndex);

  if (view === 'form') {
    return (
      <ProductFormScreen
        product={selectedProduct}
        onBack={() => {
          setSelectedProduct(undefined);
          setView('list');
        }}
        onSaved={() => {
          void refreshProducts();
        }}
      />
    );
  }

  if (view === 'adjust' && selectedProduct) {
    return (
      <StockAdjustmentScreen
        product={selectedProduct}
        onBack={() => {
          setSelectedProduct(undefined);
          setView('list');
        }}
        onSaved={() => {
          setSelectedProduct(undefined);
          void refreshProducts();
        }}
      />
    );
  }

  if (view === 'labels') {
    return (
      <LabelPrintingScreen
        products={products}
        onBack={() => setView('list')}
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

        {!isCashier && (
          <Button
            label="Nuevo producto"
            icon="add-circle-outline"
            onPress={() => {
              setSelectedProduct(undefined);
              setView('form');
            }}
          />
        )}

        <View style={styles.searchCard}>
          <Text style={styles.cardTitle}>Buscar por código o nombre</Text>
          <TextInput
            value={searchQuery}
            onChangeText={(value) => {
              setSearchQuery(value);
              setSearchMessage(null);
              setCurrentPage(1); // Resetear paginación al buscar
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
                searchMessage.startsWith('Encontrado')
                  ? styles.searchMessageOk
                  : styles.searchMessageError,
              ]}
            >
              {searchMessage}
            </Text>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {searchQuery.trim() ? 'Resultados' : 'Todos los productos'}
            {' '}({filteredProducts.length})
            {filteredProducts.length > PAGE_SIZE && (
              <Text style={styles.cardSubcount}>
                {` — pág. ${activePage} de ${totalPages}`}
              </Text>
            )}
          </Text>

          {loading ? (
            <Text style={styles.cardText}>Cargando productos...</Text>
          ) : errorMessage ? (
            <Text style={styles.errorText}>{errorMessage}</Text>
          ) : filteredProducts.length === 0 ? (
            <EmptyState
              icon={searchQuery.trim() ? 'search-outline' : 'cube-outline'}
              title={searchQuery.trim() ? 'Sin resultados' : 'Sin productos'}
              subtitle={
                searchQuery.trim()
                  ? 'No hay productos que coincidan con la búsqueda.'
                  : 'Todavía no hay productos. Creá el primero con el botón de arriba.'
              }
            />
          ) : (
            <>
              {visibleProducts.map((product) => (
                <Pressable
                  key={product.id}
                  style={styles.productRow}
                  onPress={() => {
                    if (isCashier) return;
                    setSelectedProduct(product);
                    setActionMenuVisible(true);
                  }}
                >
                  <View style={styles.productInfo}>
                    <Text style={styles.productName}>{product.name}</Text>
                    <Text style={styles.productMeta}>
                      Stock: {product.stock} {product.unit} ·{' '}
                      {product.barcode || 'Sin código'}
                    </Text>
                  </View>
                  <View style={styles.priceContainer}>
                    <Text style={styles.productPrice}>
                      $ {product.sale_price.toFixed(2)}
                    </Text>
                    {!isCashier && (
                      <Text style={styles.editIndicator}>Gestionar →</Text>
                    )}
                  </View>
                </Pressable>
              ))}

              {/* Botones de navegación Anterior / Siguiente */}
              {filteredProducts.length > PAGE_SIZE && (
                <View style={styles.paginationRow}>
                  <Pressable
                    style={[
                      styles.loadMoreButton,
                      activePage === 1 && { opacity: 0.5 }
                    ]}
                    disabled={activePage === 1}
                    onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    <Text style={styles.loadMoreText}>Anterior</Text>
                  </Pressable>
                  
                  <Text style={styles.paginationCount}>
                    {startIndex + 1}-{Math.min(endIndex, filteredProducts.length)} de {filteredProducts.length}
                  </Text>

                  <Pressable
                    style={[
                      styles.loadMoreButton,
                      activePage === totalPages && { opacity: 0.5 }
                    ]}
                    disabled={activePage === totalPages}
                    onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    <Text style={styles.loadMoreText}>Siguiente</Text>
                  </Pressable>
                </View>
              )}
            </>
          )}
        </View>

        {!isCashier && (
          <View style={styles.toolsCard}>
            <Text style={styles.toolsTitle}>Herramientas del catálogo</Text>
            <View style={styles.toolsGrid}>
              <Button
                label={isExporting ? 'Exportando...' : 'Descargar PDF'}
                icon="document-text-outline"
                variant="outline"
                onPress={handleExportProductsPDF}
                disabled={isExporting}
                loading={isExporting}
                style={styles.toolBtn}
              />
              <Button
                label="Imprimir etiquetas"
                icon="barcode-outline"
                variant="outline"
                onPress={() => setView('labels')}
                style={styles.toolBtn}
              />
            </View>
          </View>
        )}
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
              {selectedProduct?.barcode ?? 'Sin código'} · Stock:{' '}
              {selectedProduct?.stock} {selectedProduct?.unit}
            </Text>

            <Pressable
              style={styles.menuOption}
              onPress={() => {
                setActionMenuVisible(false);
                setView('form');
              }}
            >
              <Text style={styles.menuOptionText}>Editar Ficha Comercial</Text>
              <Text style={styles.menuOptionSub}>
                Modificar nombre, precios, código o categoría
              </Text>
            </Pressable>

            <Pressable
              style={[styles.menuOption, styles.menuOptionBorder]}
              onPress={() => {
                setActionMenuVisible(false);
                setView('adjust');
              }}
            >
              <Text style={styles.menuOptionText}>
                Ajustar Stock / Historial
              </Text>
              <Text style={styles.menuOptionSub}>
                Registrar entrada/salida y ver movimientos
              </Text>
            </Pressable>

            <Pressable
              style={[styles.menuOption, styles.menuOptionBorder]}
              onPress={() => {
                if (selectedProduct) {
                  handleDeleteProduct(selectedProduct);
                }
              }}
            >
              <Text style={[styles.menuOptionText, { color: '#ff4d4d' }]}>
                Eliminar Producto
              </Text>
              <Text style={styles.menuOptionSub}>
                Quitar el producto del catálogo local y del servidor
              </Text>
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

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: spacing.xl,
      paddingBottom: 120, // espacio seguro sobre la pill flotante
      gap: spacing.md,
    },
    kicker: {
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      fontSize: 12,
      fontWeight: '700',
    },
    title: {
      color: colors.text,
      fontSize: 28,
      lineHeight: 34,
      fontWeight: '800',
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
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.18)'
        : 'rgba(4, 151, 191, 0.15)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(138, 199, 255, 0.22)'
        : 'rgba(4, 151, 191, 0.35)',
      alignItems: 'center',
    },
    primaryButtonText: {
      color: isDark ? '#EAF4FF' : colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    searchCard: {
      marginTop: spacing.sm,
      padding: spacing.lg,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    searchInput: {
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? '#18181b' : '#ffffff',
      color: colors.text,
      paddingHorizontal: 12,
      paddingVertical: 10,
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
      color: colors.danger,
    },
    card: {
      marginTop: spacing.sm,
      padding: spacing.lg,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.sm,
    },
    cardTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      marginBottom: 4,
    },
    cardText: {
      color: colors.textMuted,
      fontSize: 14,
    },
    errorText: {
      color: colors.danger,
      fontSize: 14,
    },
    productRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    productRowPressed: {
      backgroundColor: isDark ? '#27272a' : '#f4f4f5',
    },
    productInfo: {
      flex: 1,
      gap: 4,
    },
    productName: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    productMeta: {
      color: colors.textMuted,
      fontSize: 12,
    },
    productPrice: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    priceContainer: {
      alignItems: 'flex-end',
      gap: 2,
    },
    editIndicator: {
      color: colors.textMuted,
      fontSize: 10,
      fontWeight: '600',
    },
    // ── Paginación Load More ──────────────────────────────────────────────
    paginationRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 12,
      marginTop: 4,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    paginationCount: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '600',
    },
    loadMoreButton: {
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: radius.sm,
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
      borderWidth: 1,
      borderColor: colors.border,
    },
    loadMoreText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
    },
    cardSubcount: {
      color: colors.textMuted,
      fontSize: 12,
      fontWeight: '400',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'flex-end',
    },
    menuContainer: {
      backgroundColor: colors.background,
      borderTopLeftRadius: radius.md,
      borderTopRightRadius: radius.md,
      padding: 24,
      paddingBottom: 36,
      gap: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    menuSubtitle: {
      color: colors.textMuted,
      fontSize: 13,
      marginTop: -8,
      marginBottom: 8,
    },
    menuOption: {
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    menuOptionBorder: {
      borderColor: isDark ? '#ffffff' : '#18181b',
      backgroundColor: isDark ? '#27272a' : '#f4f4f5',
    },
    menuOptionText: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '700',
    },
    menuOptionSub: {
      color: colors.textMuted,
      fontSize: 12,
      marginTop: 2,
    },
    menuCancelButton: {
      marginTop: 8,
      paddingVertical: 12,
      borderRadius: radius.sm,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    menuCancelText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    // ── Herramientas del Catálogo ─────────────────────────────────────────
    toolsCard: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    toolsTitle: {
      color: colors.text,
      fontSize: 15,
      fontWeight: '800',
    },
    toolsGrid: {
      flexDirection: 'column',
      gap: spacing.sm,
    },
    toolBtn: {
      width: '100%',
    },
  });
