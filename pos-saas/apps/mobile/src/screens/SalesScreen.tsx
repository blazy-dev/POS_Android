import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSQLiteContext } from 'expo-sqlite';
import type { ProductRecord, SaleRecord } from '../database/types';
import { useAuth } from '../context/AuthContext';
import { radius, spacing, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useBarcodeInput } from '../hooks/useBarcodeInput';
import { findProductByBarcode, listProducts } from '../modules/products';
import {
  closeRegister,
  getActiveSession,
  getCashSalesSum,
  openRegister,
  CashRegisterRecord,
} from '../modules/cash_registers';
import { createSale, listRecentSales } from '../modules/sales';
import { FormField } from '../components/form/FormField';

function getQuickCashOptions(total: number): number[] {
  const exact = Math.ceil(total);
  const next500 = Math.ceil(total / 500) * 500;
  const next1000 = Math.ceil(total / 1000) * 1000;
  const next5000 = Math.ceil(total / 5000) * 5000;

  const options = new Set<number>();
  options.add(exact);
  if (next500 >= total) options.add(next500);
  if (next1000 >= total) options.add(next1000);
  if (next5000 >= total) options.add(next5000);

  // Añade billetes comunes de vuelto si la cola no tiene 4 opciones
  [100, 200, 500, 1000, 2000, 5000, 10000].forEach((v) => {
    if (v >= total && options.size < 4) {
      options.add(v);
    }
  });

  return Array.from(options)
    .sort((a, b) => a - b)
    .slice(0, 4);
}

export function SalesScreen() {
  const db = useSQLiteContext();
  const { user } = useAuth();
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  const searchInputRef = useRef<TextInput>(null);

  // Estados de la sesión de caja
  const [activeSession, setActiveSession] = useState<CashRegisterRecord | null>(
    null,
  );
  const [checkingSession, setCheckingSession] = useState(true);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [expectedCash, setExpectedCash] = useState(0);

  // Vistas de la pantalla: "open" (abrir caja), "pos" (punto de venta), "close" (cerrar caja/arqueo)
  const [salesView, setSalesView] = useState<'open' | 'pos' | 'close'>('open');

  // Estados del punto de venta (POS)
  const [cart, setCart] = useState<
    Array<{ product: ProductRecord; quantity: number }>
  >([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ProductRecord[]>([]);
  const [allProducts, setAllProducts] = useState<ProductRecord[]>([]);

  // Estados del Checkout
  const [checkoutVisible, setCheckoutVisible] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'transfer'>(
    'cash',
  );
  const [cashReceived, setCashReceived] = useState('');
  const [change, setChange] = useState<number | null>(null);

  const [savingSale, setSavingSale] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicialización: busca si hay caja abierta
  async function checkSession() {
    try {
      setCheckingSession(true);
      const tenantId = user?.tenant_id || 'local';
      const session = await getActiveSession(db, tenantId);
      setActiveSession(session);
      if (session) {
        setSalesView('pos');
        // Precargar catálogo de productos para búsqueda rápida
        const catalog = await listProducts(db, tenantId);
        setAllProducts(catalog);
      } else {
        setSalesView('open');
      }
    } catch (err) {
      console.error('Error al comprobar sesión de caja:', err);
    } finally {
      setCheckingSession(false);
    }
  }

  useEffect(() => {
    void checkSession();
  }, [db, user?.tenant_id]);

  // Manejador del escaneo de código de barras
  const handleBarcodeScan = async (barcode: string) => {
    const trimmed = barcode.trim();
    if (!trimmed) return;

    try {
      const product = await findProductByBarcode(
        db,
        trimmed,
        user?.tenant_id || 'local',
      );
      if (product) {
        addToCart(product);
        setSearchQuery('');
        setSearchResults([]);
      } else {
        setErrorMsg(`Producto con código ${trimmed} no encontrado.`);
        setTimeout(() => setErrorMsg(null), 3000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (salesView === 'pos' && !checkoutVisible) {
        setTimeout(() => {
          searchInputRef.current?.focus();
        }, 50);
      }
    }
  };

  const { handleKeyPress } = useBarcodeInput({ onScan: handleBarcodeScan });

  // Maneja la búsqueda de productos al escribir
  const handleSearch = (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }

    const filtered = allProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(text.toLowerCase()) ||
        (p.barcode?.toLowerCase().includes(text.toLowerCase()) ?? false),
    );
    setSearchResults(filtered);
  };

  // Carrito: agregar producto
  const addToCart = (product: ProductRecord) => {
    const existing = cart.find((item) => item.product.id === product.id);
    const currentQty = existing ? existing.quantity : 0;

    if (product.stock < currentQty + 1) {
      setErrorMsg(
        `Stock insuficiente para ${product.name} (Disponible: ${product.stock}).`,
      );
      setTimeout(() => setErrorMsg(null), 3000);
      return;
    }

    setCart((current) => {
      const exists = current.find((item) => item.product.id === product.id);
      if (exists) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item,
        );
      }
      return [...current, { product, quantity: 1 }];
    });

    setSuccessMsg(`Agregado: ${product.name}`);
    setTimeout(() => setSuccessMsg(null), 2000);
  };

  // Carrito: modificar cantidad
  const updateQuantity = (productId: string, delta: number) => {
    setCart((current) => {
      return current
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            // Valida stock
            if (delta > 0 && item.product.stock < nextQty) {
              setErrorMsg(`Stock máximo alcanzado para ${item.product.name}.`);
              setTimeout(() => setErrorMsg(null), 3000);
              return item;
            }
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0);
    });
  };

  // Carrito: eliminar ítem
  const removeProduct = (productId: string) => {
    setCart((current) =>
      current.filter((item) => item.product.id !== productId),
    );
  };

  // Total del carrito
  const cartTotal = cart.reduce(
    (sum, item) => sum + item.product.sale_price * item.quantity,
    0,
  );

  // Calcula vuelto al ingresar efectivo
  const handleCashReceivedChange = (text: string) => {
    setCashReceived(text);
    const parsedAmount = parseFloat(text.replace(',', '.'));
    if (!Number.isNaN(parsedAmount) && parsedAmount >= cartTotal) {
      setChange(parsedAmount - cartTotal);
    } else {
      setChange(null);
    }
  };

  // Lógica de apertura de caja
  async function handleOpenRegister() {
    setErrorMsg(null);
    const amount = parseFloat(openingAmount.replace(',', '.'));
    if (Number.isNaN(amount) || amount < 0) {
      setErrorMsg('Ingresá un monto de apertura válido.');
      return;
    }

    if (!user) return;

    try {
      setCheckingSession(true);
      const sessionId = await openRegister(db, user.id, amount, user.tenant_id);
      await checkSession();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al abrir la caja.',
      );
      setCheckingSession(false);
    }
  }

  // Lógica para preparar el arqueo/cierre de caja
  async function handleInitCloseRegister() {
    if (!activeSession) return;
    try {
      setCheckingSession(true);
      const cashSales = await getCashSalesSum(
        db,
        activeSession.id,
        user?.tenant_id || 'local',
      );
      const calculatedExpectedCash = activeSession.opening_amount + cashSales;
      setExpectedCash(calculatedExpectedCash);
      setClosingAmount(calculatedExpectedCash.toString());
      setSalesView('close');
    } catch (err) {
      console.error(err);
    } finally {
      setCheckingSession(false);
    }
  }

  // Lógica de cierre de caja final
  async function handleConfirmCloseRegister() {
    setErrorMsg(null);
    const amount = parseFloat(closingAmount.replace(',', '.'));
    if (Number.isNaN(amount) || amount < 0) {
      setErrorMsg('Ingresá un monto de arqueo de cierre válido.');
      return;
    }

    if (!activeSession) return;

    try {
      setCheckingSession(true);
      await closeRegister(
        db,
        activeSession.id,
        amount,
        user?.tenant_id || 'local',
      );
      setCart([]);
      setSearchQuery('');
      setSearchResults([]);
      await checkSession();
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al cerrar la caja.',
      );
      setCheckingSession(false);
    }
  }

  // Lógica para finalizar la venta
  async function handleCompleteSale() {
    if (!activeSession) return;
    setErrorMsg(null);

    if (paymentMethod === 'cash') {
      const parsedPay = parseFloat(cashReceived.replace(',', '.'));
      if (Number.isNaN(parsedPay) || parsedPay < cartTotal) {
        setErrorMsg('El monto entregado es insuficiente o inválido.');
        return;
      }
    }

    try {
      setSavingSale(true);
      // Mapea los productos del carrito al input de createSale
      const items = cart.map((item) => ({
        productId: item.product.id,
        quantity: item.quantity,
      }));

      const tenantId = user?.tenant_id || 'local';

      await createSale(db, {
        paymentMethod,
        items,
        cashRegisterId: activeSession.id,
        userId: user?.id,
        deviceId: 'local-device',
        tenantId,
      });

      // Éxito: limpiar carrito y cerrar checkout
      setCart([]);
      setCheckoutVisible(false);
      setCashReceived('');
      setChange(null);
      // Refresca catálogo de productos en memoria para actualizar stock
      const catalog = await listProducts(db, tenantId);
      setAllProducts(catalog);
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Error al registrar la venta.',
      );
    } finally {
      setSavingSale(false);
    }
  }

  if (checkingSession) {
    return (
      <SafeAreaView style={styles.loadingArea}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  // --- VISTA A: ABRIR CAJA ---
  if (salesView === 'open') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.centerContainer}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.authHeader}>
            <Text style={styles.kicker}>Control de Turno</Text>
            <Text style={styles.title}>Apertura de Caja</Text>
            <Text style={styles.subtitle}>
              Establece el monto inicial en efectivo para comenzar a vender.
            </Text>
          </View>

          <View style={styles.formCard}>
            <FormField
              label="Monto inicial en efectivo"
              value={openingAmount}
              onChangeText={setOpeningAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              required
            />

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <Pressable
              style={styles.primaryButton}
              onPress={handleOpenRegister}
            >
              <Text style={styles.primaryButtonText}>Abrir Turno de Caja</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- VISTA C: CERRAR CAJA / ARQUEO ---
  if (salesView === 'close') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerRow}>
            <Pressable
              onPress={() => setSalesView('pos')}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>← Volver a Ventas</Text>
            </Pressable>
          </View>

          <View style={styles.authHeader}>
            <Text style={styles.kicker}>Arqueo de Turno</Text>
            <Text style={styles.title}>Cierre de Caja</Text>
          </View>

          <View style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Monto de Apertura:</Text>
              <Text style={styles.summaryValue}>
                $ {activeSession?.opening_amount.toFixed(2)}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Ventas en Efectivo:</Text>
              <Text style={styles.summaryValue}>
                ${' '}
                {(expectedCash - (activeSession?.opening_amount ?? 0)).toFixed(
                  2,
                )}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotalRow]}>
              <Text style={styles.summaryTotalLabel}>
                Saldo Teórico Esperado:
              </Text>
              <Text style={styles.summaryTotalValue}>
                $ {expectedCash.toFixed(2)}
              </Text>
            </View>
          </View>

          <View style={styles.formCard}>
            <FormField
              label="Monto real en efectivo (Arqueo físico)"
              value={closingAmount}
              onChangeText={setClosingAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              required
              hint="Cuenta el dinero en caja física e introduce el total real."
            />

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            <Pressable
              style={[styles.dangerButton, { marginTop: 10 }]}
              onPress={handleConfirmCloseRegister}
            >
              <Text style={styles.dangerButtonText}>Cerrar Caja y Turno</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // --- VISTA B: POS / VENTAS ACTIVO ---
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.posHeader}>
        <View>
          <Text style={styles.posKicker}>Caja abierta</Text>
          <Text style={styles.posUser}>Operador: {user?.name}</Text>
        </View>
        <Pressable
          style={styles.closeRegisterLink}
          onPress={handleInitCloseRegister}
        >
          <Text style={styles.closeRegisterLinkText}>Cerrar Caja</Text>
        </Pressable>
      </View>

      <View style={styles.posContainer}>
        {/* Barra de Búsqueda y Escaneo */}
        <View style={styles.searchBarContainer}>
          <TextInput
            ref={searchInputRef}
            value={searchQuery}
            onChangeText={handleSearch}
            onKeyPress={handleKeyPress}
            onSubmitEditing={() => {
              void handleBarcodeScan(searchQuery);
            }}
            placeholder="Escaneá código o buscá por nombre..."
            placeholderTextColor="#708090"
            style={styles.searchInput}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            blurOnSubmit={false}
          />
        </View>

        {errorMsg ? (
          <View style={styles.errorBanner}>
            <Text style={styles.errorBannerText}>{errorMsg}</Text>
          </View>
        ) : null}

        {/* Dropdown de Búsqueda */}
        {searchQuery.trim() ? (
          <View style={styles.searchResultsContainer}>
            <Text style={styles.searchTitle}>
              Catálogo ({searchResults.length})
            </Text>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.searchResultRow}
                  onPress={() => {
                    addToCart(item);
                    setSearchQuery('');
                    setSearchResults([]);
                  }}
                >
                  <View style={styles.searchResultInfo}>
                    <Text style={styles.searchResultName}>{item.name}</Text>
                    <Text style={styles.searchResultMeta}>
                      Stock: {item.stock} {item.unit} · Barcode:{' '}
                      {item.barcode ?? 'Sin código'}
                    </Text>
                  </View>
                  <Text style={styles.searchResultPrice}>
                    $ {item.sale_price.toFixed(2)}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        ) : (
          /* Carrito de Compras */
          <View style={styles.cartContainer}>
            {cart.length === 0 ? (
              <View style={styles.emptyCartContainer}>
                <Text style={styles.emptyCartTitle}>Carrito vacío</Text>
                <Text style={styles.emptyCartSub}>
                  Escaneá un producto o búscalo con el buscador de arriba.
                </Text>
              </View>
            ) : (
              <>
                {successMsg ? (
                  <View style={styles.successBanner}>
                    <Text style={styles.successBannerText}>✓ {successMsg}</Text>
                  </View>
                ) : null}
                <FlatList
                  data={cart}
                  keyExtractor={(item) => item.product.id}
                  renderItem={({ item }) => (
                    <View style={styles.cartRow}>
                      <View style={styles.cartItemInfo}>
                        <Text style={styles.cartItemName}>
                          {item.product.name}
                        </Text>
                        <Text style={styles.cartItemPrice}>
                          $ {item.product.sale_price.toFixed(2)} x{' '}
                          {item.product.unit}
                        </Text>
                      </View>

                      <View style={styles.cartItemActions}>
                        <View style={styles.qtyContainer}>
                          <Pressable
                            style={styles.qtyBtn}
                            onPress={() => updateQuantity(item.product.id, -1)}
                          >
                            <Text style={styles.qtyBtnText}>-</Text>
                          </Pressable>
                          <Text style={styles.qtyText}>{item.quantity}</Text>
                          <Pressable
                            style={styles.qtyBtn}
                            onPress={() => updateQuantity(item.product.id, 1)}
                          >
                            <Text style={styles.qtyBtnText}>+</Text>
                          </Pressable>
                        </View>
                        <Pressable
                          style={styles.deleteBtn}
                          onPress={() => removeProduct(item.product.id)}
                        >
                          <Text style={styles.deleteBtnText}>🗑</Text>
                        </Pressable>
                      </View>
                    </View>
                  )}
                />

                {/* Resumen del Total y Cobro */}
                <View style={styles.cartSummary}>
                  <View style={styles.totalRow}>
                    <Text style={styles.totalLabel}>Total:</Text>
                    <Text style={styles.totalValue}>
                      $ {cartTotal.toFixed(2)}
                    </Text>
                  </View>
                  <Pressable
                    style={styles.checkoutBtn}
                    onPress={() => setCheckoutVisible(true)}
                  >
                    <Text style={styles.checkoutBtnText}>Cobrar Venta</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        )}
      </View>

      {/* --- MODAL DE COBRO (CHECKOUT) --- */}
      <Modal
        visible={checkoutVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setCheckoutVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setCheckoutVisible(false)}
        >
          <View
            style={styles.modalContainer}
            onStartShouldSetResponder={() => true}
          >
            <Text style={styles.modalTitle}>Detalle de Cobro</Text>

            {/* Total Destacado */}
            <View style={styles.checkoutTotalCard}>
              <Text style={styles.checkoutTotalLabel}>Total a pagar</Text>
              <Text style={styles.checkoutTotalValue}>
                $ {cartTotal.toFixed(2)}
              </Text>
            </View>

            {/* Selector de Método de Pago */}
            <Text style={styles.inputLabel}>Método de pago</Text>
            <View style={styles.paymentSelector}>
              <Pressable
                style={[
                  styles.paymentOptionBtn,
                  paymentMethod === 'cash' && styles.paymentOptionActive,
                ]}
                onPress={() => {
                  setPaymentMethod('cash');
                  setCashReceived('');
                  setChange(null);
                }}
              >
                <Text
                  style={[
                    styles.paymentOptionText,
                    paymentMethod === 'cash' && styles.paymentOptionTextActive,
                  ]}
                >
                  Efectivo
                </Text>
              </Pressable>

              <Pressable
                style={[
                  styles.paymentOptionBtn,
                  paymentMethod === 'transfer' && styles.paymentOptionActive,
                ]}
                onPress={() => {
                  setPaymentMethod('transfer');
                  setCashReceived('');
                  setChange(null);
                }}
              >
                <Text
                  style={[
                    styles.paymentOptionText,
                    paymentMethod === 'transfer' &&
                      styles.paymentOptionTextActive,
                  ]}
                >
                  Transferencia
                </Text>
              </Pressable>
            </View>

            {/* Campos adicionales para efectivo */}
            {paymentMethod === 'cash' ? (
              <View style={styles.cashForm}>
                <FormField
                  label="Paga con (Dinero entregado)"
                  value={cashReceived}
                  onChangeText={handleCashReceivedChange}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  required
                />

                {/* Botones de efectivo rápido */}
                <View style={styles.quickCashContainer}>
                  {getQuickCashOptions(cartTotal).map((val) => (
                    <Pressable
                      key={val}
                      style={styles.quickCashBtn}
                      onPress={() => handleCashReceivedChange(val.toString())}
                    >
                      <Text style={styles.quickCashBtnText}>${val}</Text>
                    </Pressable>
                  ))}
                </View>

                {change !== null ? (
                  <View style={styles.changeCard}>
                    <Text style={styles.changeLabel}>
                      Vuelto para el cliente:
                    </Text>
                    <Text style={styles.changeValue}>
                      $ {change.toFixed(2)}
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : (
              <View style={styles.transferForm}>
                <Text style={styles.transferNotice}>
                  Solicitá al cliente la transferencia e ingresá los fondos al
                  saldo bancario.
                </Text>
              </View>
            )}

            {errorMsg ? <Text style={styles.errorText}>{errorMsg}</Text> : null}

            {/* Botones de acción */}
            <View style={styles.checkoutActions}>
              <Pressable
                style={styles.cancelCheckoutBtn}
                onPress={() => setCheckoutVisible(false)}
                disabled={savingSale}
              >
                <Text style={styles.cancelCheckoutBtnText}>Cancelar</Text>
              </Pressable>

              <Pressable
                style={[
                  styles.confirmCheckoutBtn,
                  savingSale && styles.buttonDisabled,
                ]}
                onPress={() => {
                  void handleCompleteSale();
                }}
                disabled={savingSale}
              >
                <Text style={styles.confirmCheckoutBtnText}>
                  {savingSale ? 'Procesando...' : 'Finalizar Venta'}
                </Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    loadingArea: {
      flex: 1,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    safeArea: {
      flex: 1,
      backgroundColor: colors.background,
    },
    container: {
      padding: spacing.xl,
      gap: spacing.lg,
    },
    centerContainer: {
      flexGrow: 1,
      padding: spacing.xl,
      justifyContent: 'center',
      gap: spacing.lg,
    },
    headerRow: {
      marginBottom: -10,
    },
    backLink: {
      alignSelf: 'flex-start',
      paddingVertical: 6,
    },
    backLinkText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    authHeader: {
      gap: 6,
      alignItems: 'center',
    },
    kicker: {
      color: colors.primary,
      textTransform: 'uppercase',
      letterSpacing: 1.4,
      fontSize: 11,
      fontWeight: '800',
    },
    title: {
      color: colors.text,
      fontSize: 26,
      fontWeight: '800',
      textAlign: 'center',
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 14,
      lineHeight: 20,
      textAlign: 'center',
    },
    formCard: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(138, 199, 255, 0.14)' : colors.border,
      gap: spacing.md,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    errorText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 13,
      textAlign: 'center',
    },
    primaryButton: {
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
    primaryButtonText: {
      color: isDark ? '#EAF4FF' : colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    dangerButton: {
      paddingVertical: 14,
      borderRadius: radius.md,
      backgroundColor: isDark
        ? 'rgba(255, 180, 180, 0.1)'
        : 'rgba(211, 47, 47, 0.08)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255, 180, 180, 0.22)'
        : 'rgba(211, 47, 47, 0.18)',
      alignItems: 'center',
    },
    dangerButtonText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 14,
      fontWeight: '800',
    },
    summaryCard: {
      padding: spacing.lg,
      borderRadius: radius.lg,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.04)'
        : colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.border,
      gap: 10,
    },
    summaryRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    summaryLabel: {
      color: colors.textMuted,
      fontSize: 14,
    },
    summaryValue: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    summaryTotalRow: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: 10,
      marginTop: 2,
    },
    summaryTotalLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
    },
    summaryTotalValue: {
      color: colors.primary,
      fontSize: 18,
      fontWeight: '800',
    },
    posHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      backgroundColor: isDark ? 'rgba(7, 17, 31, 0.4)' : colors.surface,
    },
    posKicker: {
      color: colors.success,
      fontSize: 10,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    posUser: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    closeRegisterLink: {
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: isDark
        ? 'rgba(255, 180, 180, 0.08)'
        : 'rgba(211, 47, 47, 0.08)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255, 180, 180, 0.18)'
        : 'rgba(211, 47, 47, 0.18)',
    },
    closeRegisterLinkText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 12,
      fontWeight: '800',
    },
    posContainer: {
      flex: 1,
      padding: spacing.xl,
      gap: spacing.md,
    },
    searchBarContainer: {
      gap: spacing.sm,
    },
    searchInput: {
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.surface,
      color: colors.text,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
    },
    errorBanner: {
      backgroundColor: isDark
        ? 'rgba(255, 180, 180, 0.15)'
        : 'rgba(211, 47, 47, 0.08)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255, 180, 180, 0.35)'
        : 'rgba(211, 47, 47, 0.18)',
      padding: 10,
      borderRadius: 10,
    },
    errorBannerText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 13,
      textAlign: 'center',
      fontWeight: '700',
    },
    searchResultsContainer: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.sm,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 3 },
        elevation: 2,
      }),
    },
    searchTitle: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '800',
      marginBottom: 4,
    },
    searchResultRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    searchResultInfo: {
      gap: 4,
      flex: 1,
    },
    searchResultName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    searchResultMeta: {
      color: colors.textMuted,
      fontSize: 11,
    },
    searchResultPrice: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    cartContainer: {
      flex: 1,
      gap: spacing.md,
    },
    emptyCartContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
    },
    emptyCartTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    emptyCartSub: {
      color: colors.textMuted,
      fontSize: 13,
      textAlign: 'center',
      maxWidth: 240,
      lineHeight: 18,
    },
    cartRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 14,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 10,
      ...(!isDark && {
        shadowColor: '#000',
        shadowOpacity: 0.02,
        shadowRadius: 4,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
      }),
    },
    cartItemInfo: {
      flex: 1,
      gap: 4,
      paddingRight: 8,
    },
    cartItemName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    cartItemPrice: {
      color: colors.textMuted,
      fontSize: 12,
    },
    cartItemActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    qtyContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.04)'
        : colors.surfaceSoft,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 2,
    },
    qtyBtn: {
      width: 28,
      height: 28,
      borderRadius: 8,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.08)'
        : 'rgba(4, 151, 191, 0.08)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyBtnText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    qtyText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      paddingHorizontal: 8,
      textAlign: 'center',
      minWidth: 24,
    },
    deleteBtn: {
      padding: 8,
      borderRadius: 10,
      backgroundColor: isDark
        ? 'rgba(255, 180, 180, 0.08)'
        : 'rgba(211, 47, 47, 0.08)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(255, 180, 180, 0.15)'
        : 'rgba(211, 47, 47, 0.18)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteBtnText: {
      color: isDark ? '#FFB4B4' : '#D32F2F',
      fontSize: 13,
    },
    successBanner: {
      backgroundColor: isDark
        ? 'rgba(122, 230, 179, 0.15)'
        : 'rgba(1, 203, 99, 0.08)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(122, 230, 179, 0.35)'
        : 'rgba(1, 203, 99, 0.18)',
      padding: 10,
      borderRadius: 10,
      marginBottom: 8,
    },
    successBannerText: {
      color: colors.success,
      fontSize: 13,
      textAlign: 'center',
      fontWeight: '700',
    },
    quickCashContainer: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'space-between',
      marginVertical: 4,
    },
    quickCashBtn: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.08)'
        : 'rgba(4, 151, 191, 0.08)',
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    quickCashBtnText: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    cartSummary: {
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 12,
    },
    totalRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    totalLabel: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
    },
    totalValue: {
      color: colors.primary,
      fontSize: 22,
      fontWeight: '800',
    },
    checkoutBtn: {
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
    checkoutBtnText: {
      color: isDark ? '#EAF4FF' : colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      justifyContent: 'flex-end',
    },
    modalContainer: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      paddingBottom: 36,
      gap: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    modalTitle: {
      color: colors.text,
      fontSize: 18,
      fontWeight: '800',
    },
    checkoutTotalCard: {
      padding: 16,
      borderRadius: 14,
      backgroundColor: colors.surfaceCard,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    checkoutTotalLabel: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    checkoutTotalValue: {
      color: colors.primary,
      fontSize: 22,
      fontWeight: '800',
    },
    inputLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginBottom: -8,
    },
    paymentSelector: {
      flexDirection: 'row',
      gap: spacing.md,
    },
    paymentOptionBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.03)'
        : colors.surfaceSoft,
      alignItems: 'center',
      justifyContent: 'center',
    },
    paymentOptionActive: {
      borderColor: colors.primary,
      backgroundColor: isDark
        ? 'rgba(138, 199, 255, 0.16)'
        : 'rgba(4, 151, 191, 0.15)',
    },
    paymentOptionText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    paymentOptionTextActive: {
      color: isDark ? '#FFFFFF' : colors.primary,
      fontWeight: '800',
    },
    cashForm: {
      gap: 12,
    },
    changeCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 12,
      borderRadius: radius.md,
      backgroundColor: isDark
        ? 'rgba(122, 230, 179, 0.08)'
        : 'rgba(1, 203, 99, 0.08)',
      borderWidth: 1,
      borderColor: isDark
        ? 'rgba(122, 230, 179, 0.18)'
        : 'rgba(1, 203, 99, 0.18)',
    },
    changeLabel: {
      color: colors.textMuted,
      fontSize: 13,
      fontWeight: '700',
    },
    changeValue: {
      color: colors.success,
      fontSize: 18,
      fontWeight: '800',
    },
    transferForm: {
      padding: 14,
      borderRadius: radius.md,
      backgroundColor: isDark
        ? 'rgba(255, 255, 255, 0.02)'
        : colors.surfaceSoft,
      borderWidth: 1,
      borderColor: colors.border,
    },
    transferNotice: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
      textAlign: 'center',
    },
    checkoutActions: {
      flexDirection: 'row',
      gap: spacing.md,
      marginTop: 8,
    },
    cancelCheckoutBtn: {
      paddingVertical: 14,
      paddingHorizontal: 18,
      borderRadius: radius.md,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cancelCheckoutBtnText: {
      color: colors.textMuted,
      fontSize: 14,
      fontWeight: '700',
    },
    confirmCheckoutBtn: {
      flex: 1,
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
    confirmCheckoutBtnText: {
      color: isDark ? '#EAF4FF' : colors.primary,
      fontSize: 14,
      fontWeight: '800',
    },
    buttonDisabled: {
      opacity: 0.6,
    },
  });
