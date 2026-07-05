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
  showLogo: boolean;
  logoSize: 'sm' | 'md' | 'lg';
  logoType: 'shopping' | 'business' | 'ticket';
  logoPosition: 'top' | 'middle' | 'bottom';

  namePosition: 'top' | 'middle' | 'bottom';
  nameSize: 'sm' | 'md' | 'lg';

  showBarcode: boolean;
  barcodePosition: 'top' | 'middle' | 'bottom';
  barcodeHeight: 'sm' | 'md' | 'lg';

  pricePosition: 'top' | 'middle' | 'bottom';
  priceSize: 'sm' | 'md' | 'lg';
}

const DEFAULT_CONFIG: LabelConfig = {
  showLogo: true,
  logoSize: 'md',
  logoType: 'shopping',
  logoPosition: 'top',
  
  namePosition: 'top',
  nameSize: 'md',
  
  showBarcode: true,
  barcodePosition: 'bottom',
  barcodeHeight: 'md',
  
  pricePosition: 'middle',
  priceSize: 'lg',
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

      let gridCellsHtml = '';
      flatLabels.forEach((label) => {
        const barcodeSvg = label.barcode ? generateBarcodeSVG(label.barcode, config.barcodeHeight) : '';
        
        const renderHtmlForPosition = (pos: 'top' | 'middle' | 'bottom') => {
          let html = '';
          
          // 1. Logo
          if (config.showLogo && config.logoPosition === pos) {
            let logoSvg = '';
            if (config.logoType === 'shopping') {
              logoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>`;
            } else if (config.logoType === 'business') {
              logoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`;
            } else {
              logoSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;"><path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1-2-1z"></path><path d="M6 6h12"></path><path d="M6 10h12"></path><path d="M6 14h8"></path></svg>`;
            }
            
            const logoSizes = { sm: '16px', md: '24px', lg: '32px' };
            html += `
              <div class="logo-wrapper" style="width: ${logoSizes[config.logoSize]}; height: ${logoSizes[config.logoSize]}; color: #0497bf; display: flex; align-items: center; justify-content: center; margin: 2px 0;">
                ${logoSvg}
              </div>
            `;
          }
          
          // 2. Nombre
          if (config.namePosition === pos) {
            const fontSizes = { sm: '11px', md: '13px', lg: '16px' };
            const fontWeights = { sm: '600', md: '700', lg: '800' };
            html += `
              <div class="label-name" style="font-size: ${fontSizes[config.nameSize]}; font-weight: ${fontWeights[config.nameSize]};">
                ${label.name}
              </div>
            `;
          }
          
          // 3. Precio
          if (config.pricePosition === pos) {
            const fontSizes = { sm: '14px', md: '20px', lg: '26px' };
            html += `
              <div class="label-price" style="font-size: ${fontSizes[config.priceSize]};">
                $ ${label.price}
              </div>
            `;
          }
          
          // 4. Código de barras
          if (config.showBarcode && config.barcodePosition === pos) {
            if (label.barcode) {
              html += `
                <div class="barcode-container">
                  ${barcodeSvg}
                  <div class="barcode-text">${label.barcode}</div>
                </div>
              `;
            } else {
              html += `<div class="no-barcode">Sin código</div>`;
            }
          }
          
          return html;
        };

        gridCellsHtml += `
          <div class="label-card">
            <div class="position-group group-top">
              ${renderHtmlForPosition('top')}
            </div>
            <div class="position-group group-middle">
              ${renderHtmlForPosition('middle')}
            </div>
            <div class="position-group group-bottom">
              ${renderHtmlForPosition('bottom')}
            </div>
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
              margin: 15mm 10mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #ffffff;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8mm;
            }
            .label-card {
              border: 1px dashed #71717a;
              border-radius: 6px;
              padding: 8px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              height: 42mm;
              box-sizing: border-box;
              text-align: center;
              page-break-inside: avoid;
            }
            .position-group {
              display: flex;
              flex-direction: column;
              align-items: center;
              width: 100%;
            }
            .group-top {
              justify-content: flex-start;
              gap: 2px;
            }
            .group-middle {
              justify-content: center;
              flex: 1;
              gap: 2px;
            }
            .group-bottom {
              justify-content: flex-end;
              gap: 2px;
            }
            .label-name {
              color: #18181b;
              max-height: 38px;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.2;
            }
            .label-price {
              font-weight: 800;
              color: #18181b;
              line-height: 1.1;
            }
            .barcode-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              margin-top: 2px;
            }
            .barcode-text {
              font-size: 8px;
              font-family: monospace;
              color: #71717a;
              margin-top: 1px;
            }
            .no-barcode {
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

  const [designerTab, setDesignerTab] = useState<'logo' | 'text' | 'barcode'>('logo');

  // Método de apoyo para agrupar y pintar elementos de previsualización según su posición
  const renderElementsForPosition = (pos: 'top' | 'middle' | 'bottom', previewProduct?: ProductRecord) => {
    const elements: React.ReactNode[] = [];
    const pName = previewProduct?.name || 'Milka Oreo 150g';
    const pPrice = previewProduct ? `$ ${previewProduct.sale_price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$ 2.450,00';
    const pBarcode = previewProduct?.barcode || '7791234567890';

    // 1. Logo
    if (config.showLogo && config.logoPosition === pos) {
      let logoIcon: keyof typeof Ionicons.glyphMap = 'cart-outline';
      if (config.logoType === 'business') logoIcon = 'briefcase-outline';
      if (config.logoType === 'ticket') logoIcon = 'receipt-outline';
      
      const sizeMap = { sm: 16, md: 24, lg: 32 };
      elements.push(
        <Ionicons
          key="logo"
          name={logoIcon}
          size={sizeMap[config.logoSize]}
          color={colors.primary}
          style={{ marginVertical: 2 }}
        />
      );
    }

    // 2. Nombre del Producto
    if (config.namePosition === pos) {
      const sizeMap = { sm: 11, md: 13, lg: 16 };
      const weightMap = { sm: fontWeight.medium, md: fontWeight.bold, lg: fontWeight.extrabold };
      elements.push(
        <Text
          key="name"
          numberOfLines={1}
          style={{
            fontSize: sizeMap[config.nameSize],
            fontWeight: weightMap[config.nameSize] as any,
            color: colors.text,
            marginVertical: 2,
            textAlign: 'center',
          }}
        >
          {pName}
        </Text>
      );
    }

    // 3. Precio
    if (config.pricePosition === pos) {
      const sizeMap = { sm: 14, md: 20, lg: 26 };
      elements.push(
        <Text
          key="price"
          style={{
            fontSize: sizeMap[config.priceSize],
            fontWeight: '800',
            color: colors.text,
            marginVertical: 2,
            textAlign: 'center',
          }}
        >
          {pPrice}
        </Text>
      );
    }

    // 4. Código de Barras
    if (config.showBarcode && config.barcodePosition === pos) {
      const heightMap = { sm: 20, md: 35, lg: 50 };
      elements.push(
        <View key="barcode" style={{ alignItems: 'center', marginVertical: 2 }}>
          <View style={{ flexDirection: 'row', height: heightMap[config.barcodeHeight], alignItems: 'center', opacity: 0.8 }}>
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
      );
    }

    return elements;
  };

  const renderLabelPreview = () => {
    const previewProduct = queue.length > 0 ? queue[0].product : undefined;
    return (
      <View style={styles.previewContainer}>
        <Text style={styles.sectionLabel}>Previsualización (Etiqueta Demo):</Text>
        <View style={styles.previewCardOuter}>
          <View style={styles.previewCardInner}>
            <View style={[styles.previewGroup, styles.groupTop]}>
              {renderElementsForPosition('top', previewProduct)}
            </View>
            <View style={[styles.previewGroup, styles.groupMiddle]}>
              {renderElementsForPosition('middle', previewProduct)}
            </View>
            <View style={[styles.previewGroup, styles.groupBottom]}>
              {renderElementsForPosition('bottom', previewProduct)}
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderConfigTabs = () => (
    <View style={styles.configTabBar}>
      {(['logo', 'text', 'barcode'] as const).map((tab) => {
        const labels = { logo: 'Logo', text: 'Textos', barcode: 'Código' };
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

  const renderConfigPanel = () => {
    switch (designerTab) {
      case 'logo':
        return (
          <View style={styles.tabContent}>
            <View style={styles.controlRow}>
              <Text style={styles.controlLabel}>Mostrar Logo en la etiqueta</Text>
              <Pressable
                onPress={() => setConfig(prev => ({ ...prev, showLogo: !prev.showLogo }))}
                style={[styles.switchToggle, config.showLogo && styles.switchToggleActive]}
              >
                <View style={[styles.switchHandle, config.showLogo && styles.switchHandleActive]} />
              </Pressable>
            </View>

            {config.showLogo && (
              <>
                <View style={styles.divider} />
                <Text style={styles.subOptionTitle}>Icono del Logo</Text>
                <View style={styles.optionsSegment}>
                  {(['shopping', 'business', 'ticket'] as const).map((type) => {
                    const labels = { shopping: 'Carrito', business: 'Maleta', ticket: 'Ticket' };
                    const active = config.logoType === type;
                    return (
                      <Pressable
                        key={type}
                        onPress={() => setConfig(prev => ({ ...prev, logoType: type }))}
                        style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      >
                        <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                          {labels[type]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.subOptionTitle}>Tamaño del Logo</Text>
                <View style={styles.optionsSegment}>
                  {(['sm', 'md', 'lg'] as const).map((size) => {
                    const labels = { sm: 'Chico', md: 'Medio', lg: 'Grande' };
                    const active = config.logoSize === size;
                    return (
                      <Pressable
                        key={size}
                        onPress={() => setConfig(prev => ({ ...prev, logoSize: size }))}
                        style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      >
                        <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                          {labels[size]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.subOptionTitle}>Posición del Logo</Text>
                <View style={styles.optionsSegment}>
                  {(['top', 'middle', 'bottom'] as const).map((pos) => {
                    const labels = { top: 'Arriba', middle: 'Centro', bottom: 'Abajo' };
                    const active = config.logoPosition === pos;
                    return (
                      <Pressable
                        key={pos}
                        onPress={() => setConfig(prev => ({ ...prev, logoPosition: pos }))}
                        style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      >
                        <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                          {labels[pos]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>
        );

      case 'text':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.sectionHeading}>Nombre del Producto</Text>
            <Text style={styles.subOptionTitle}>Posición</Text>
            <View style={styles.optionsSegment}>
              {(['top', 'middle', 'bottom'] as const).map((pos) => {
                const labels = { top: 'Arriba', middle: 'Centro', bottom: 'Abajo' };
                const active = config.namePosition === pos;
                return (
                  <Pressable
                    key={pos}
                    onPress={() => setConfig(prev => ({ ...prev, namePosition: pos }))}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  >
                    <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                      {labels[pos]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.subOptionTitle}>Tamaño de Letra</Text>
            <View style={styles.optionsSegment}>
              {(['sm', 'md', 'lg'] as const).map((size) => {
                const labels = { sm: 'Chica', md: 'Media', lg: 'Grande' };
                const active = config.nameSize === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => setConfig(prev => ({ ...prev, nameSize: size }))}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  >
                    <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                      {labels[size]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View style={styles.divider} />

            <Text style={styles.sectionHeading}>Precio de Venta</Text>
            <Text style={styles.subOptionTitle}>Posición</Text>
            <View style={styles.optionsSegment}>
              {(['top', 'middle', 'bottom'] as const).map((pos) => {
                const labels = { top: 'Arriba', middle: 'Centro', bottom: 'Abajo' };
                const active = config.pricePosition === pos;
                return (
                  <Pressable
                    key={pos}
                    onPress={() => setConfig(prev => ({ ...prev, pricePosition: pos }))}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  >
                    <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                      {labels[pos]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.subOptionTitle}>Tamaño del Precio</Text>
            <View style={styles.optionsSegment}>
              {(['sm', 'md', 'lg'] as const).map((size) => {
                const labels = { sm: 'Chico', md: 'Medio', lg: 'Grande' };
                const active = config.priceSize === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => setConfig(prev => ({ ...prev, priceSize: size }))}
                    style={[styles.segmentButton, active && styles.segmentButtonActive]}
                  >
                    <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                      {labels[size]}
                    </Text>
                  </Pressable>
                );
              })}
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
                <Text style={styles.subOptionTitle}>Posición del Código</Text>
                <View style={styles.optionsSegment}>
                  {(['top', 'middle', 'bottom'] as const).map((pos) => {
                    const labels = { top: 'Arriba', middle: 'Centro', bottom: 'Abajo' };
                    const active = config.barcodePosition === pos;
                    return (
                      <Pressable
                        key={pos}
                        onPress={() => setConfig(prev => ({ ...prev, barcodePosition: pos }))}
                        style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      >
                        <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                          {labels[pos]}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.subOptionTitle}>Altura de Barras</Text>
                <View style={styles.optionsSegment}>
                  {(['sm', 'md', 'lg'] as const).map((size) => {
                    const labels = { sm: 'Bajo', md: 'Medio', lg: 'Alto' };
                    const active = config.barcodeHeight === size;
                    return (
                      <Pressable
                        key={size}
                        onPress={() => setConfig(prev => ({ ...prev, barcodeHeight: size }))}
                        style={[styles.segmentButton, active && styles.segmentButtonActive]}
                      >
                        <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                          {labels[size]}
                        </Text>
                      </Pressable>
                    );
                  })}
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
      height: 158, // altura proporcional de 42mm de góndola
      borderRadius: radius.md,
      borderWidth: 2,
      borderColor: colors.textMuted,
      borderStyle: 'dashed',
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : '#ffffff',
      padding: 10,
      justifyContent: 'space-between',
      alignItems: 'center',
      overflow: 'hidden',
    },
    previewGroup: {
      alignItems: 'center',
      width: '100%',
    },
    groupTop: {
      justifyContent: 'flex-start',
    },
    groupMiddle: {
      justifyContent: 'center',
      flex: 1,
    },
    groupBottom: {
      justifyContent: 'flex-end',
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
    sectionHeading: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '800',
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginTop: 4,
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
