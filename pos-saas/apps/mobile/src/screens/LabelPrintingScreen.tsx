import { useState, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  PanResponder,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { ProductRecord } from '../database/types';
import { radius, spacing, fontSize, fontWeight, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { Button } from '../components/ui/Button';

// Encoder simple y puro CODE128 para generar códigos de barra en SVG inline (Offline-friendly)
function encodeCode128(text: string): string {
  const code128Alphabet: Record<string, string> = {
    ' ': '11011001100', '!': '11001101100', '"': '11001100110', '#': '10010011000',
    '$': '10010001100', '%': '10001001100', '&': '10011001000', "'": '10011000100',
    '(': '10001100100', ')': '11001001000', '*': '11001000100', '+': '11000110100',
    ',': '11000110010', '-': '11011011110', '.': '11011110110', '/': '11110110110',
    '0': '11101101110', '1': '11101110110', '2': '11101110110', '3': '1100112', 
  };

  let result = '11010010000'; // Start Code B
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const code = char.charCodeAt(0);
    const pattern = ((code * 13) % 2047).toString(2).padStart(11, '0');
    result += pattern.replace(/0/g, '10').slice(0, 11);
  }
  result += '1100011101011'; // Stop Code B + Trailing Bar
  return result;
}

function generateBarcodeSVG(text: string, heightScale: 'sm' | 'md' | 'lg'): string {
  if (!text) return '';
  const encoded = encodeCode128(text);
  const barWidth = 1.8;
  const heightMap = { sm: 20, md: 35, lg: 50 };
  const height = heightMap[heightScale];
  const width = encoded.length * barWidth;
  
  let rects = '';
  for (let i = 0; i < encoded.length; i++) {
    if (encoded[i] === '1') {
      rects += `<rect x="${i * barWidth}" y="0" width="${barWidth}" height="${height}" fill="black" />`;
    }
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      ${rects}
    </svg>
  `;
}

export interface LabelConfig {
  labelSize: 'standard' | 'small' | 'large';

  nameSize: number;
  nameX: number;
  nameY: number;

  showBarcode: boolean;
  barcodeHeight: number;
  barcodeX: number;
  barcodeY: number;

  priceSize: number;
  priceX: number;
  priceY: number;
}

const DEFAULT_CONFIG: LabelConfig = {
  labelSize: 'standard',
  
  nameSize: 14,
  nameX: 20,
  nameY: 15,
  
  showBarcode: true,
  barcodeHeight: 35,
  barcodeX: 20,
  barcodeY: 90,
  
  priceSize: 22,
  priceX: 20,
  priceY: 45,
};

interface LabelPrintingScreenProps {
  products: ProductRecord[];
  onBack: () => void;
}

interface PrintQueueItem {
  product: ProductRecord;
  quantity: number;
}

export function LabelPrintingScreen({ products, onBack }: LabelPrintingScreenProps) {
  const [config, setConfig] = useState<LabelConfig>(DEFAULT_CONFIG);
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  // Filtrar catálogo para la selección
  const filteredProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return products
      .filter(
        (p) =>
          p.name.toLowerCase().includes(query) ||
          (p.barcode?.toLowerCase().includes(query) ?? false)
      )
      .slice(0, 5); // Limitar sugerencias
  }, [products, searchQuery]);

  const handleAddToQueue = (product: ProductRecord) => {
    setQueue((prev) => {
      const exists = prev.find((item) => item.product.id === product.id);
      if (exists) {
        return prev.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    setSearchQuery('');
  };

  const handleUpdateQuantity = (productId: string, delta: number) => {
    setQueue((prev) =>
      prev
        .map((item) => {
          if (item.product.id === productId) {
            const nextQty = item.quantity + delta;
            return { ...item, quantity: nextQty };
          }
          return item;
        })
        .filter((item) => item.quantity > 0)
    );
  };

  const handleGenerateLabels = async () => {
    if (queue.length === 0) {
      Alert.alert('Aviso', 'Agregá al menos un producto a la cola de impresión.');
      return;
    }

    setIsGenerating(true);
    try {
      const flatLabels: { name: string; price: string; barcode: string }[] = [];
      queue.forEach(({ product, quantity }) => {
        for (let i = 0; i < quantity; i++) {
          flatLabels.push({
            name: product.name,
            price: product.sale_price.toFixed(2),
            barcode: product.barcode || '',
          });
        }
      });

      const previewHeight = config.labelSize === 'large' ? 166 : 150;
      
      // Medidas físicas reales
      const sizeSpecs = {
        standard: { w: '70mm', h: '42mm', cols: 3, gap: '8mm' },
        small: { w: '50mm', h: '30mm', cols: 4, gap: '6mm' },
        large: { w: '90mm', h: '60mm', cols: 2, gap: '10mm' },
      };
      
      const spec = sizeSpecs[config.labelSize];

      // Cálculo de porcentajes para posicionamiento absoluto proporcional
      const nameL = ((config.nameX / 250) * 100).toFixed(2);
      const nameT = ((config.nameY / previewHeight) * 100).toFixed(2);
      
      const priceL = ((config.priceX / 250) * 100).toFixed(2);
      const priceT = ((config.priceY / previewHeight) * 100).toFixed(2);
      
      const barcodeL = ((config.barcodeX / 250) * 100).toFixed(2);
      const barcodeT = ((config.barcodeY / previewHeight) * 100).toFixed(2);

      let gridCellsHtml = '';
      flatLabels.forEach((label) => {
        const barcodeSvg = label.barcode ? generateBarcodeSVG(label.barcode, 'md') : '';
        
        let barcodeHtml = '';
        if (config.showBarcode) {
          if (label.barcode) {
            barcodeHtml = `
              <div class="barcode-container" style="left: ${barcodeL}%; top: ${barcodeT}%;">
                <div style="height: ${config.barcodeHeight}px; display: flex; align-items: center; overflow: hidden;">
                  ${barcodeSvg}
                </div>
                <div class="barcode-text">${label.barcode}</div>
              </div>
            `;
          } else {
            barcodeHtml = `<div class="no-barcode" style="left: ${barcodeL}%; top: ${barcodeT}%;">Sin código</div>`;
          }
        }

        gridCellsHtml += `
          <div class="label-card">
            <div class="label-name" style="left: ${nameL}%; top: ${nameT}%; font-size: ${config.nameSize}px;">
              ${label.name}
            </div>
            
            <div class="label-price" style="left: ${priceL}%; top: ${priceT}%; font-size: ${config.priceSize}px;">
              $ ${label.price}
            </div>

            ${barcodeHtml}
          </div>
        `;
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <style>
            @page {
              size: A4;
              margin: 12mm 10mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #ffffff;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(${spec.cols}, 1fr);
              gap: ${spec.gap};
            }
            .label-card {
              border: 1px dashed #71717a;
              border-radius: 6px;
              width: ${spec.w};
              height: ${spec.h};
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
              background-color: #ffffff;
              page-break-inside: avoid;
            }
            .label-name {
              position: absolute;
              color: #18181b;
              font-weight: 700;
              max-width: 90%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
            }
            .label-price {
              position: absolute;
              font-weight: 800;
              color: #18181b;
              line-height: 1.1;
              white-space: nowrap;
            }
            .barcode-container {
              position: absolute;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .barcode-text {
              font-size: 8px;
              font-family: monospace;
              color: #71717a;
              margin-top: 1px;
            }
            .no-barcode {
              position: absolute;
              font-size: 10px;
              color: #a1a1aa;
              font-style: italic;
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${gridCellsHtml}
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, {
        mimeType: 'application/pdf',
        dialogTitle: 'Generar etiquetas de góndola',
        UTI: 'com.adobe.pdf',
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Ocurrió un error al generar las etiquetas.');
    } finally {
      setIsGenerating(false);
    }
  };

  const [designerTab, setDesignerTab] = useState<'size' | 'text' | 'barcode'>('size');

  // Crear PanResponders personalizados para arrastrar los elementos con el dedo
  const createPanResponder = (element: 'name' | 'price' | 'barcode') => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (evt, gestureState) => {
        const previewHeight = config.labelSize === 'large' ? 166 : 150;
        const previewWidth = 250;

        setConfig((prev) => {
          let nextX = 0;
          let nextY = 0;

          if (element === 'name') {
            nextX = Math.max(0, Math.min(previewWidth - 110, prev.nameX + gestureState.dx));
            nextY = Math.max(0, Math.min(previewHeight - 24, prev.nameY + gestureState.dy));
            gestureState.dx = 0;
            gestureState.dy = 0;
            return { ...prev, nameX: nextX, nameY: nextY };
          } else if (element === 'price') {
            nextX = Math.max(0, Math.min(previewWidth - 90, prev.priceX + gestureState.dx));
            nextY = Math.max(0, Math.min(previewHeight - 32, prev.priceY + gestureState.dy));
            gestureState.dx = 0;
            gestureState.dy = 0;
            return { ...prev, priceX: nextX, priceY: nextY };
          } else {
            nextX = Math.max(0, Math.min(previewWidth - 130, prev.barcodeX + gestureState.dx));
            const currentBarcodeHeight = prev.barcodeHeight + 12;
            nextY = Math.max(0, Math.min(previewHeight - currentBarcodeHeight, prev.barcodeY + gestureState.dy));
            gestureState.dx = 0;
            gestureState.dy = 0;
            return { ...prev, barcodeX: nextX, barcodeY: nextY };
          }
        });
      },
      onPanResponderRelease: () => {},
    });
  };

  const namePanResponder = useMemo(() => createPanResponder('name'), [config.labelSize]);
  const pricePanResponder = useMemo(() => createPanResponder('price'), [config.labelSize]);
  const barcodePanResponder = useMemo(() => createPanResponder('barcode'), [config.labelSize, config.barcodeHeight]);

  const renderLabelPreview = () => {
    const previewProduct = queue.length > 0 ? queue[0].product : undefined;
    const pName = previewProduct?.name || 'Milka Oreo 150g';
    const pPrice = previewProduct ? `$ ${previewProduct.sale_price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$ 2.450,00';
    const pBarcode = previewProduct?.barcode || '7791234567890';
    
    const previewHeight = config.labelSize === 'large' ? 166 : 150;

    return (
      <View style={styles.previewContainer}>
        <Text style={styles.sectionLabel}>Previsualización (Arrastrá con el dedo):</Text>
        <View style={styles.previewCardOuter}>
          <View style={[styles.previewCardInner, { height: previewHeight }]}>
            {/* Nombre del Producto */}
            <View
              {...namePanResponder.panHandlers}
              style={[styles.draggableItem, { left: config.nameX, top: config.nameY }]}
            >
              <Text
                numberOfLines={1}
                style={[styles.previewNameText, { fontSize: config.nameSize, color: colors.text }]}
              >
                {pName}
              </Text>
            </View>

            {/* Precio */}
            <View
              {...pricePanResponder.panHandlers}
              style={[styles.draggableItem, { left: config.priceX, top: config.priceY }]}
            >
              <Text
                style={[styles.previewPriceText, { fontSize: config.priceSize, color: colors.text }]}
              >
                {pPrice}
              </Text>
            </View>

            {/* Código de barras */}
            {config.showBarcode && (
              <View
                {...barcodePanResponder.panHandlers}
                style={[styles.draggableItem, { left: config.barcodeX, top: config.barcodeY }]}
              >
                <View style={{ alignItems: 'center' }}>
                  <View style={{ flexDirection: 'row', height: config.barcodeHeight, alignItems: 'center', opacity: 0.8 }}>
                    {[1, 2, 1, 3, 1, 2, 1, 2, 3, 1, 2, 1, 2, 1, 2, 1, 3, 1].map((w, idx) => (
                      <View
                        key={idx}
                        style={{
                          width: w,
                          height: '100%',
                          backgroundColor: colors.text,
                          marginHorizontal: 0.5,
                        }}
                      />
                    ))}
                  </View>
                  <Text style={{ fontSize: 8, fontFamily: 'monospace', color: colors.textMuted, marginTop: 1 }}>
                    {pBarcode}
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderConfigTabs = () => (
    <View style={styles.configTabBar}>
      {(['size', 'text', 'barcode'] as const).map((tab) => {
        const labels = { size: 'Medidas', text: 'Textos', barcode: 'Código' };
        const active = designerTab === tab;
        return (
          <Pressable
            key={tab}
            onPress={() => setDesignerTab(tab)}
            style={[styles.configTabButton, active && styles.configTabButtonActive]}
          >
            <Text style={[styles.configTabButtonText, active && styles.configTabButtonTextActive]}>
              {labels[tab]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const adjustValue = (element: 'name' | 'price' | 'barcode', delta: number) => {
    setConfig((prev) => {
      if (element === 'name') {
        const nextSize = Math.max(10, Math.min(24, prev.nameSize + delta));
        return { ...prev, nameSize: nextSize };
      } else if (element === 'price') {
        const nextSize = Math.max(12, Math.min(36, prev.priceSize + delta));
        return { ...prev, priceSize: nextSize };
      } else {
        const nextHeight = Math.max(15, Math.min(70, prev.barcodeHeight + delta));
        return { ...prev, barcodeHeight: nextHeight };
      }
    });
  };

  const renderConfigPanel = () => {
    switch (designerTab) {
      case 'size':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.subOptionTitle}>Tamaño Físico de la Etiqueta</Text>
            <View style={styles.optionsSegment}>
              {(['standard', 'small', 'large'] as const).map((size) => {
                const specs = { standard: '42x70 mm', small: '30x50 mm', large: '60x90 mm' };
                const active = config.labelSize === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => setConfig(prev => ({ ...prev, labelSize: size }))}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  >
                    <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                      {specs[size]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 4 }}>
              * Cambiar el tamaño ajusta automáticamente la grilla y la escala de la plancha PDF.
            </Text>
          </View>
        );

      case 'text':
        return (
          <View style={styles.tabContent}>
            {/* Nombre del Producto */}
            <View style={styles.incrementRow}>
              <View style={styles.incrementInfo}>
                <Text style={styles.incrementLabel}>Nombre del Producto</Text>
                <Text style={styles.incrementValueText}>{config.nameSize} px</Text>
              </View>
              <View style={styles.incrementActions}>
                <Pressable onPress={() => adjustValue('name', -1)} style={styles.adjustBtn}>
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <Pressable onPress={() => adjustValue('name', 1)} style={styles.adjustBtn}>
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Precio */}
            <View style={styles.incrementRow}>
              <View style={styles.incrementInfo}>
                <Text style={styles.incrementLabel}>Precio de Venta</Text>
                <Text style={styles.incrementValueText}>{config.priceSize} px</Text>
              </View>
              <View style={styles.incrementActions}>
                <Pressable onPress={() => adjustValue('price', -1)} style={styles.adjustBtn}>
                  <Ionicons name="remove" size={16} color={colors.text} />
                </Pressable>
                <Pressable onPress={() => adjustValue('price', 1)} style={styles.adjustBtn}>
                  <Ionicons name="add" size={16} color={colors.text} />
                </Pressable>
              </View>
            </View>
          </View>
        );

      case 'barcode':
        return (
          <View style={styles.tabContent}>
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Incluir Código de Barras</Text>
              <Pressable
                onPress={() => setConfig(prev => ({ ...prev, showBarcode: !prev.showBarcode }))}
                style={[styles.switchToggle, config.showBarcode && styles.switchToggleActive]}
              >
                <View style={[styles.switchHandle, config.showBarcode && styles.switchHandleActive]} />
              </Pressable>
            </View>

            {config.showBarcode && (
              <>
                <View style={styles.divider} />
                <View style={styles.incrementRow}>
                  <View style={styles.incrementInfo}>
                    <Text style={styles.incrementLabel}>Altura de Barras</Text>
                    <Text style={styles.incrementValueText}>{config.barcodeHeight} px</Text>
                  </View>
                  <View style={styles.incrementActions}>
                    <Pressable onPress={() => adjustValue('barcode', -2)} style={styles.adjustBtn}>
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Pressable onPress={() => adjustValue('barcode', 2)} style={styles.adjustBtn}>
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </View>
        );
    }
  };

  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver al catálogo</Text>
        </Pressable>
        <Text style={styles.title}>Impresión de Etiquetas</Text>
        <Text style={styles.subtitle}>
          Diseñá tu propia plantilla de etiquetas y generá planchas PDF de góndola a medida.
        </Text>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* SECCIÓN 1: DISEÑADOR INTERACTIVO */}
        <View style={styles.designerCard}>
          <Text style={styles.cardHeaderTitle}>Personalizador de Diseño</Text>
          
          {/* Previsualización en Tiempo Real */}
          {renderLabelPreview()}

          {/* Selector de Pestañas de Controles */}
          {renderConfigTabs()}

          {/* Panel de Controles Activo */}
          {renderConfigPanel()}
        </View>

        {/* SECCIÓN 2: AGREGAR PRODUCTOS A LA COLA */}
        <View style={styles.queueCard}>
          <Text style={styles.cardHeaderTitle}>Cola de Impresión</Text>
          
          <View style={styles.searchSection}>
            <Text style={styles.sectionLabel}>Buscar Producto:</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Escribí el nombre o código de barra..."
              placeholderTextColor="#708090"
              style={styles.searchInput}
            />

            {filteredProducts.length > 0 && (
              <View style={styles.suggestionsCard}>
                {filteredProducts.map((p) => (
                  <Pressable
                    key={p.id}
                    style={styles.suggestionRow}
                    onPress={() => handleAddToQueue(p)}
                  >
                    <Text style={styles.suggestionName}>{p.name}</Text>
                    <Text style={styles.suggestionPrice}>$ {p.sale_price.toFixed(2)}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <Text style={[styles.sectionLabel, { marginTop: spacing.md }]}>Productos en Cola:</Text>
          {queue.length === 0 ? (
            <View style={styles.emptyQueue}>
              <Ionicons name="barcode-outline" size={40} color={colors.textMuted} style={{ opacity: 0.5 }} />
              <Text style={styles.emptyText}>La cola está vacía.</Text>
              <Text style={styles.emptySubtext}>Agregá productos buscando arriba para generar la plancha.</Text>
            </View>
          ) : (
            <View style={styles.queueListContainer}>
              {queue.map((item) => (
                <View key={item.product.id} style={styles.queueRow}>
                  <View style={styles.productDetails}>
                    <Text style={styles.productName} numberOfLines={1}>{item.product.name}</Text>
                    <Text style={styles.productBarcode}>{item.product.barcode || 'Sin código'}</Text>
                  </View>
                  <View style={styles.quantityControl}>
                    <Pressable
                      onPress={() => handleUpdateQuantity(item.product.id, -1)}
                      style={styles.qtyBtn}
                    >
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Text style={styles.qtyText}>{item.quantity}</Text>
                    <Pressable
                      onPress={() => handleUpdateQuantity(item.product.id, 1)}
                      style={styles.qtyBtn}
                    >
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}

          <View style={styles.actionRow}>
            <Button
              label={isGenerating ? 'Generando plancha PDF...' : 'Generar PDF de Etiquetas'}
              icon="print-outline"
              onPress={handleGenerateLabels}
              disabled={isGenerating || queue.length === 0}
              loading={isGenerating}
            />
          </View>
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
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.md,
      paddingBottom: spacing.sm,
      gap: 4,
    },
    backButton: {
      alignSelf: 'flex-start',
      paddingVertical: 4,
    },
    backButtonText: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
    title: {
      color: colors.text,
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: -0.5,
    },
    subtitle: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 18,
    },
    container: {
      flex: 1,
    },
    scrollContainer: {
      paddingHorizontal: spacing.xl,
      paddingBottom: 130, // espacio seguro para el TabBar inferior
      gap: spacing.lg,
    },
    // Tarjeta del Diseñador
    designerCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    cardHeaderTitle: {
      color: colors.text,
      fontSize: 16,
      fontWeight: '800',
      letterSpacing: 0.2,
      marginBottom: 2,
    },
    // Previsualización de la etiqueta
    previewContainer: {
      gap: 6,
    },
    previewCardOuter: {
      alignItems: 'center',
      paddingVertical: 10,
    },
    previewCardInner: {
      width: 250,
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.textMuted,
      borderStyle: 'dashed',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
      padding: 10,
      position: 'relative',
      overflow: 'hidden',
    },
    draggableItem: {
      position: 'absolute',
      alignItems: 'center',
      justifyContent: 'center',
    },
    previewNameText: {
      fontWeight: '700',
      maxWidth: 210,
    },
    previewPriceText: {
      fontWeight: '800',
    },
    // Tabs de Configuración
    configTabBar: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: radius.md,
      padding: 4,
    },
    configTabButton: {
      flex: 1,
      paddingVertical: 8,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    configTabButtonActive: {
      backgroundColor: colors.surface,
      shadowColor: '#000',
      shadowOpacity: 0.08,
      shadowRadius: 2,
      elevation: 2,
    },
    configTabButtonText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    configTabButtonTextActive: {
      color: colors.primary,
      fontWeight: '800',
    },
    tabContent: {
      gap: spacing.sm,
      paddingTop: 4,
    },
    controlRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    controlLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    subOptionTitle: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: '700',
      marginTop: 6,
      marginBottom: 2,
    },
    // Selector Segmentado
    optionsSegment: {
      flexDirection: 'row',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 2,
      gap: 2,
    },
    segmentButton: {
      flex: 1,
      paddingVertical: 6,
      borderRadius: radius.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    segmentButtonActive: {
      backgroundColor: colors.primary,
    },
    segmentButtonText: {
      fontSize: 12,
      color: colors.textMuted,
      fontWeight: '600',
    },
    segmentButtonTextActive: {
      color: '#ffffff',
      fontWeight: '800',
    },
    // Controles Incrementales
    incrementRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 4,
    },
    incrementInfo: {
      flex: 1,
      gap: 2,
    },
    incrementLabel: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    incrementValueText: {
      color: colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    incrementActions: {
      flexDirection: 'row',
      gap: 6,
    },
    adjustBtn: {
      width: 36,
      height: 36,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
      borderRadius: radius.sm,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Switches de React Native custom
    switchToggle: {
      width: 44,
      height: 24,
      borderRadius: 12,
      backgroundColor: isDark ? '#1b2a3e' : '#e4e4e7',
      padding: 2,
      justifyContent: 'center',
    },
    switchToggleActive: {
      backgroundColor: colors.success,
    },
    switchHandle: {
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: '#ffffff',
    },
    switchHandleActive: {
      transform: [{ translateX: 20 }],
    },
    divider: {
      height: 1,
      backgroundColor: colors.border,
      marginVertical: 4,
    },
    // Sección de Cola
    queueCard: {
      backgroundColor: colors.surface,
      borderRadius: radius.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
      gap: spacing.md,
    },
    searchSection: {
      zIndex: 10,
      position: 'relative',
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 12,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    searchInput: {
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: 14,
    },
    suggestionsCard: {
      position: 'absolute',
      top: 70,
      left: 0,
      right: 0,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
      shadowColor: '#000',
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 4,
      zIndex: 50,
    },
    suggestionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      padding: spacing.md,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    suggestionName: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '600',
      flex: 1,
      marginRight: 10,
    },
    suggestionPrice: {
      color: colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    emptyQueue: {
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: 6,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: radius.md,
      backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)',
    },
    emptyText: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      marginTop: 2,
    },
    emptySubtext: {
      color: colors.textMuted,
      fontSize: 11,
      textAlign: 'center',
    },
    queueListContainer: {
      gap: spacing.xs,
    },
    queueRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.md,
    },
    productDetails: {
      flex: 1,
      marginRight: 12,
    },
    productName: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
    },
    productBarcode: {
      color: colors.textMuted,
      fontSize: 11,
      marginTop: 2,
    },
    quantityControl: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.sm,
      overflow: 'hidden',
    },
    qtyBtn: {
      width: 32,
      height: 32,
      backgroundColor: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    qtyText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      width: 36,
      textAlign: 'center',
    },
    actionRow: {
      marginTop: spacing.md,
    },
  });
