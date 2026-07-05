import { useState, useMemo, useEffect } from 'react';
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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useSQLiteContext } from 'expo-sqlite';
import type { ProductRecord } from '../database/types';
import { radius, spacing, fontSize, fontWeight, ThemeColors } from '../theme/tokens';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { getAppMeta, setAppMeta } from '../database';
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

function generateBarcodeSVG(text: string, height: number): string {
  if (!text) return '';
  const encoded = encodeCode128(text);
  const barWidth = 1.8;
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
  labelSize: 'standard' | 'small' | 'large' | 'custom';
  customWidth: number; // en mm
  customHeight: number; // en mm

  logoType: 'none' | 'stock' | 'own';
  logoSize: number;
  logoX: number;
  logoY: number;

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
  customWidth: 70,
  customHeight: 42,

  logoType: 'stock',
  logoSize: 24,
  logoX: 20,
  logoY: 10,

  nameSize: 14,
  nameX: 20,
  nameY: 38,

  showBarcode: true,
  barcodeHeight: 35,
  barcodeX: 20,
  barcodeY: 92,

  priceSize: 22,
  priceX: 20,
  priceY: 60,
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
  const db = useSQLiteContext();
  const { user } = useAuth();
  
  const [config, setConfig] = useState<LabelConfig>(DEFAULT_CONFIG);
  const [searchQuery, setSearchQuery] = useState('');
  const [queue, setQueue] = useState<PrintQueueItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [logoOwnUri, setLogoOwnUri] = useState<string | null>(null);

  // Cargar el logo de la tienda y la última configuración de etiquetas si están disponibles en app_metadata
  useEffect(() => {
    async function loadConfigAndLogo() {
      if (user?.tenant_id) {
        try {
          // 1. Cargar Logo
          const logo = await getAppMeta<string>(db, `tenant_logo_${user.tenant_id}`);
          if (logo) {
            setLogoOwnUri(logo);
          }

          // 2. Cargar Configuración de Etiquetas
          const savedConfigStr = await getAppMeta<string>(db, `labels_config_${user.tenant_id}`);
          if (savedConfigStr) {
            const parsed = JSON.parse(savedConfigStr);
            setConfig({
              ...DEFAULT_CONFIG,
              ...parsed,
            });
            if (parsed.customWidth) setCustomWidthStr(String(parsed.customWidth));
            if (parsed.customHeight) setCustomHeightStr(String(parsed.customHeight));
          }
        } catch (e) {
          console.error('[DATABASE] Error cargando configuración/logo del comercio:', e);
        }
      }
    }
    void loadConfigAndLogo();
  }, [user, db]);

  const persistConfig = (newConfig: LabelConfig) => {
    if (user?.tenant_id) {
      void setAppMeta(db, `labels_config_${user.tenant_id}`, JSON.stringify(newConfig));
    }
  };

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
      // Intentar leer y codificar el logo propio a Base64 para inyectarlo en el HTML de la Webview de expo-print
      let base64LogoDataUrl = '';
      if (config.logoType === 'own' && logoOwnUri) {
        try {
          const base64Str = await FileSystem.readAsStringAsync(logoOwnUri, {
            encoding: 'base64',
          });
          const ext = logoOwnUri.split('.').pop()?.toLowerCase() || 'png';
          const mimeType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
          base64LogoDataUrl = `data:${mimeType};base64,${base64Str}`;
        } catch (err) {
          console.error('[PDF] Error al convertir logo a base64:', err);
        }
      }

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

      const previewHeight = config.labelSize === 'custom'
        ? Math.round(250 * (config.customHeight / config.customWidth))
        : (config.labelSize === 'large' ? 166 : 150);
      
      // Obtener ancho y alto físico de la etiqueta seleccionada
      let wMm = 70;
      let hMm = 42;

      if (config.labelSize === 'small') {
        wMm = 50;
        hMm = 30;
      } else if (config.labelSize === 'large') {
        wMm = 90;
        hMm = 60;
      } else if (config.labelSize === 'custom') {
        wMm = config.customWidth;
        hMm = config.customHeight;
      }

      // Columnas, gap y márgenes dinámicos para que encaje perfectamente en la hoja A4 (210mm de ancho neto)
      let cols = 3;
      let gapMm = 6;
      let marginPageMm = 10;

      if (wMm > 85) {
        cols = 1;
        gapMm = 0;
        marginPageMm = 15;
      } else if (wMm > 65) {
        cols = 2;
        gapMm = 8;
        marginPageMm = 12;
      } else if (wMm > 45) {
        cols = 3;
        gapMm = 6;
        marginPageMm = 10;
      } else {
        cols = 4;
        gapMm = 4;
        marginPageMm = 8;
      }

      // Conversión de píxeles del preview a milímetros físicos en la etiqueta
      const scaleX = wMm / 250;
      const scaleY = hMm / previewHeight;

      // Calcular posiciones en mm para el PDF
      const nameLMm = (config.nameX * scaleX).toFixed(2);
      const nameTMm = (config.nameY * scaleY).toFixed(2);
      const nameSizeMm = (config.nameSize * scaleX).toFixed(2);

      const priceLMm = (config.priceX * scaleX).toFixed(2);
      const priceTMm = (config.priceY * scaleY).toFixed(2);
      const priceSizeMm = (config.priceSize * scaleX).toFixed(2);

      const barcodeLMm = (config.barcodeX * scaleX).toFixed(2);
      const barcodeTMm = (config.barcodeY * scaleY).toFixed(2);
      const barcodeHeightMm = (config.barcodeHeight * scaleY).toFixed(2);

      const logoLMm = (config.logoX * scaleX).toFixed(2);
      const logoTMm = (config.logoY * scaleY).toFixed(2);
      const logoSizeMm = (config.logoSize * scaleX).toFixed(2);

      let gridCellsHtml = '';
      flatLabels.forEach((label) => {
        // SVG en milímetros para evitar desbordes y pixelación
        let barcodeHtml = '';
        if (config.showBarcode) {
          if (label.barcode) {
            const encoded = encodeCode128(label.barcode);
            const barWidth = 1.8;
            const svgWidthPx = encoded.length * barWidth;
            const svgWidthMm = (svgWidthPx * scaleX).toFixed(2);
            
            // Limitar ancho máximo al espacio restante de la tarjeta
            const maxBarcodeWidthMm = Math.max(10, wMm - parseFloat(barcodeLMm) - 2);

            let rects = '';
            for (let i = 0; i < encoded.length; i++) {
              if (encoded[i] === '1') {
                rects += `<rect x="${i * barWidth}" y="0" width="${barWidth}" height="${config.barcodeHeight}" fill="black" />`;
              }
            }
            const barcodeSvg = `
              <svg width="100%" height="100%" viewBox="0 0 ${svgWidthPx} ${config.barcodeHeight}" xmlns="http://www.w3.org/2000/svg">
                ${rects}
              </svg>
            `;

            barcodeHtml = `
              <div class="barcode-container" style="left: ${barcodeLMm}mm; top: ${barcodeTMm}mm; width: ${svgWidthMm}mm; max-width: ${maxBarcodeWidthMm}mm; height: calc(${barcodeHeightMm}mm + 12px);">
                <div style="height: ${barcodeHeightMm}mm; display: flex; align-items: center; overflow: hidden; width: 100%;">
                  ${barcodeSvg}
                </div>
                <div class="barcode-text">${label.barcode}</div>
              </div>
            `;
          } else {
            barcodeHtml = `<div class="no-barcode" style="left: ${barcodeLMm}mm; top: ${barcodeTMm}mm;">Sin código</div>`;
          }
        }

        let logoHtml = '';
        if (config.logoType === 'stock') {
          logoHtml = `
            <div class="logo-container" style="left: ${logoLMm}mm; top: ${logoTMm}mm; width: ${logoSizeMm}mm; height: ${logoSizeMm}mm; color: #0497bf;">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 100%; height: 100%;"><circle cx="9" cy="21" r="1"></circle><circle cx="20" cy="21" r="1"></circle><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path></svg>
            </div>
          `;
        } else if (config.logoType === 'own' && base64LogoDataUrl) {
          logoHtml = `
            <img src="${base64LogoDataUrl}" style="left: ${logoLMm}mm; top: ${logoTMm}mm; width: ${logoSizeMm}mm; height: ${logoSizeMm}mm; object-fit: contain; position: absolute;" />
          `;
        }

        // Anchos máximos para textos
        const maxNameWidthMm = Math.max(10, wMm - parseFloat(nameLMm) - 4);
        const maxPriceWidthMm = Math.max(10, wMm - parseFloat(priceLMm) - 4);

        gridCellsHtml += `
          <div class="label-card">
            ${logoHtml}
            
            <div class="label-name" style="left: ${nameLMm}mm; top: ${nameTMm}mm; font-size: ${nameSizeMm}mm; width: ${maxNameWidthMm}mm;">
              ${label.name}
            </div>
            
            <div class="label-price" style="left: ${priceLMm}mm; top: ${priceTMm}mm; font-size: ${priceSizeMm}mm; width: ${maxPriceWidthMm}mm;">
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
              margin: ${marginPageMm}mm;
            }
            body {
              font-family: system-ui, -apple-system, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #ffffff;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(${cols}, ${wMm}mm);
              gap: ${gapMm}mm;
              justify-content: center;
            }
            .label-card {
              border: 1px dashed #71717a;
              border-radius: 4px;
              width: ${wMm}mm;
              height: ${hMm}mm;
              box-sizing: border-box;
              position: relative;
              overflow: hidden;
              background-color: #ffffff;
              page-break-inside: avoid;
            }
            .logo-container {
              position: absolute;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .label-name {
              position: absolute;
              color: #18181b;
              font-weight: 700;
              width: 90%;
              white-space: nowrap;
              overflow: hidden;
              text-overflow: ellipsis;
              line-height: 1.1;
            }
            .label-price {
              position: absolute;
              font-weight: 800;
              color: #18181b;
              line-height: 1.0;
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

  const [designerTab, setDesignerTab] = useState<'size' | 'logo' | 'text' | 'barcode'>('size');
  
  // Estados para milímetros personalizados
  const [customWidthStr, setCustomWidthStr] = useState('70');
  const [customHeightStr, setCustomHeightStr] = useState('42');
  const [customSizeError, setCustomSizeError] = useState<string | null>(null);

  const handleCustomWidthChange = (val: string) => {
    setCustomWidthStr(val);
    const parsedWidth = parseFloat(val);
    const parsedHeight = parseFloat(customHeightStr);
    
    if (isNaN(parsedWidth)) {
      setCustomSizeError('El ancho debe ser un número válido.');
      return;
    }
    
    if (parsedWidth < 30 || parsedWidth > 120) {
      setCustomSizeError('El ancho debe estar entre 30 y 120 mm.');
      return;
    }
    
    if (!isNaN(parsedHeight) && parsedWidth < parsedHeight) {
      setCustomSizeError('El ancho debe ser mayor o igual al alto.');
      return;
    }
    
    setCustomSizeError(null);
    setConfig((prev) => {
      const next = { ...prev, customWidth: parsedWidth };
      persistConfig(next);
      return next;
    });
  };

  const handleCustomHeightChange = (val: string) => {
    setCustomHeightStr(val);
    const parsedWidth = parseFloat(customWidthStr);
    const parsedHeight = parseFloat(val);
    
    if (isNaN(parsedHeight)) {
      setCustomSizeError('El alto debe ser un número válido.');
      return;
    }
    
    if (parsedHeight < 15 || parsedHeight > 80) {
      setCustomSizeError('El alto debe estar entre 15 y 80 mm.');
      return;
    }
    
    if (!isNaN(parsedWidth) && parsedWidth < parsedHeight) {
      setCustomSizeError('El ancho debe ser mayor o igual al alto.');
      return;
    }
    
    setCustomSizeError(null);
    setConfig((prev) => {
      const next = { ...prev, customHeight: parsedHeight };
      persistConfig(next);
      return next;
    });
  };

  // Crear PanResponders personalizados para arrastrar los elementos con el dedo
  const createPanResponder = (element: 'name' | 'price' | 'barcode' | 'logo') => {
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {},
      onPanResponderMove: (evt, gestureState) => {
        const previewHeight = config.labelSize === 'custom'
          ? Math.round(250 * (config.customHeight / config.customWidth))
          : (config.labelSize === 'large' ? 166 : 150);
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
          } else if (element === 'logo') {
            nextX = Math.max(0, Math.min(previewWidth - prev.logoSize, prev.logoX + gestureState.dx));
            nextY = Math.max(0, Math.min(previewHeight - prev.logoSize, prev.logoY + gestureState.dy));
            gestureState.dx = 0;
            gestureState.dy = 0;
            return { ...prev, logoX: nextX, logoY: nextY };
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
      onPanResponderRelease: () => {
        setConfig((current) => {
          persistConfig(current);
          return current;
        });
      },
    });
  };

  const namePanResponder = useMemo(() => createPanResponder('name'), [config.labelSize]);
  const pricePanResponder = useMemo(() => createPanResponder('price'), [config.labelSize]);
  const logoPanResponder = useMemo(() => createPanResponder('logo'), [config.labelSize, config.logoSize]);
  const barcodePanResponder = useMemo(() => createPanResponder('barcode'), [config.labelSize, config.barcodeHeight]);

  const renderLabelPreview = () => {
    const previewProduct = queue.length > 0 ? queue[0].product : undefined;
    const pName = previewProduct?.name || 'Milka Oreo 150g';
    const pPrice = previewProduct ? `$ ${previewProduct.sale_price.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$ 2.450,00';
    const pBarcode = previewProduct?.barcode || '7791234567890';
    
    const previewHeight = config.labelSize === 'custom'
      ? Math.round(250 * (config.customHeight / config.customWidth))
      : (config.labelSize === 'large' ? 166 : 150);

    return (
      <View style={styles.previewContainer}>
        <Text style={styles.sectionLabel}>Previsualización (Arrastrá con el dedo):</Text>
        <View style={styles.previewCardOuter}>
          <View style={[styles.previewCardInner, { height: previewHeight }]}>
            {/* Logo */}
            {config.logoType !== 'none' && (
              <View
                {...logoPanResponder.panHandlers}
                style={[styles.draggableItem, { left: config.logoX, top: config.logoY }]}
              >
                {config.logoType === 'stock' ? (
                  <Ionicons
                    name="cart-outline"
                    size={config.logoSize}
                    color={colors.primary}
                  />
                ) : logoOwnUri ? (
                  <Image
                    source={{ uri: logoOwnUri }}
                    style={{ width: config.logoSize, height: config.logoSize, resizeMode: 'contain' }}
                  />
                ) : (
                  <Ionicons
                    name="image-outline"
                    size={config.logoSize}
                    color={colors.textMuted}
                  />
                )}
              </View>
            )}

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
      {(['size', 'logo', 'text', 'barcode'] as const).map((tab) => {
        const labels = { size: 'Medidas', logo: 'Logo', text: 'Textos', barcode: 'Código' };
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

  const adjustValue = (element: 'name' | 'price' | 'barcode' | 'logo', delta: number) => {
    setConfig((prev) => {
      let next = { ...prev };
      if (element === 'name') {
        const nextSize = Math.max(10, Math.min(24, prev.nameSize + delta));
        next = { ...prev, nameSize: nextSize };
      } else if (element === 'price') {
        const nextSize = Math.max(12, Math.min(36, prev.priceSize + delta));
        next = { ...prev, priceSize: nextSize };
      } else if (element === 'logo') {
        const nextSize = Math.max(16, Math.min(48, prev.logoSize + delta));
        next = { ...prev, logoSize: nextSize };
      } else {
        const nextHeight = Math.max(15, Math.min(70, prev.barcodeHeight + delta));
        next = { ...prev, barcodeHeight: nextHeight };
      }
      persistConfig(next);
      return next;
    });
  };

  const renderConfigPanel = () => {
    switch (designerTab) {
      case 'size':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.subOptionTitle}>Tamaño Físico de la Etiqueta</Text>
            <View style={styles.gridSegmentContainer}>
              {(['standard', 'small', 'large', 'custom'] as const).map((size) => {
                const specs = { 
                  standard: 'Estándar\n(70x42 mm)', 
                  small: 'Chica\n(50x30 mm)', 
                  large: 'Grande\n(90x60 mm)', 
                  custom: 'Medida\nPersonalizada' 
                };
                const active = config.labelSize === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => setConfig(prev => {
                      const next = { ...prev, labelSize: size };
                      persistConfig(next);
                      return next;
                    })}
                    style={[styles.gridSegmentButton, active && styles.gridSegmentButtonActive]}
                  >
                    <Text style={[styles.gridSegmentButtonText, active && styles.gridSegmentButtonTextActive]}>
                      {specs[size]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            
            {config.labelSize === 'custom' && (
              <View style={{ marginTop: spacing.md, gap: spacing.sm }}>
                <Text style={styles.sectionHeading}>Dimensiones Manuales (mm)</Text>
                
                <View style={{ flexDirection: 'row', gap: spacing.md }}>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>Ancho (30 a 120 mm)</Text>
                    <TextInput
                      value={customWidthStr}
                      onChangeText={handleCustomWidthChange}
                      keyboardType="numeric"
                      style={styles.searchInput}
                      placeholder="Ancho (mm)"
                    />
                  </View>
                  
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textMuted }}>Alto (15 a 80 mm)</Text>
                    <TextInput
                      value={customHeightStr}
                      onChangeText={handleCustomHeightChange}
                      keyboardType="numeric"
                      style={styles.searchInput}
                      placeholder="Alto (mm)"
                    />
                  </View>
                </View>
                
                {customSizeError && (
                  <Text style={{ color: colors.danger, fontSize: 11, fontWeight: '700', marginTop: 2 }}>
                    ⚠️ {customSizeError}
                  </Text>
                )}
              </View>
            )}

            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 6 }}>
              * Cambiar el tamaño ajusta automáticamente la grilla y la escala de la plancha PDF.
            </Text>
          </View>
        );

      case 'logo':
        return (
          <View style={styles.tabContent}>
            <Text style={styles.subOptionTitle}>Tipo de Logo</Text>
            <View style={styles.optionsSegment}>
              {(['none', 'stock', 'own'] as const).map((type) => {
                const labels = { none: 'Ninguno', stock: 'Carrito (Stock)', own: 'Logo Propio' };
                const isOwnAndNoLogo = type === 'own' && !logoOwnUri;
                const active = config.logoType === type;
                return (
                  <Pressable
                    key={type}
                    disabled={isOwnAndNoLogo}
                    onPress={() => setConfig(prev => {
                      const next = { ...prev, logoType: type };
                      persistConfig(next);
                      return next;
                    })}
                    style={[
                      styles.segmentButton, 
                      active && styles.segmentButtonActive,
                      isOwnAndNoLogo && { opacity: 0.35 }
                    ]}
                  >
                    <Text style={[styles.segmentButtonText, active && styles.segmentButtonTextActive]}>
                      {labels[type]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {config.logoType === 'own' && !logoOwnUri && (
              <Text style={{ color: colors.warning, fontSize: 11, fontWeight: '700', marginTop: 4 }}>
                ⚠️ Aún no has subido tu logo de comercio. Configúralo en Ajustes {`->`} Perfil de Comercio.
              </Text>
            )}

            {config.logoType !== 'none' && (
              <>
                <View style={styles.divider} />
                <View style={styles.incrementRow}>
                  <View style={styles.incrementInfo}>
                    <Text style={styles.incrementLabel}>Tamaño del Logo</Text>
                    <Text style={styles.incrementValueText}>{config.logoSize} px</Text>
                  </View>
                  <View style={styles.incrementActions}>
                    <Pressable onPress={() => adjustValue('logo', -2)} style={styles.adjustBtn}>
                      <Ionicons name="remove" size={16} color={colors.text} />
                    </Pressable>
                    <Pressable onPress={() => adjustValue('logo', 2)} style={styles.adjustBtn}>
                      <Ionicons name="add" size={16} color={colors.text} />
                    </Pressable>
                  </View>
                </View>
              </>
            )}
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
                onPress={() => setConfig(prev => {
                  const next = { ...prev, showBarcode: !prev.showBarcode };
                  persistConfig(next);
                  return next;
                })}
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
    // Selector de Medidas 2x2 responsivo
    gridSegmentContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      justifyContent: 'space-between',
      marginTop: 4,
    },
    gridSegmentButton: {
      width: '48%',
      paddingVertical: 10,
      paddingHorizontal: 8,
      borderRadius: radius.md,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    gridSegmentButtonActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    gridSegmentButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 16,
    },
    gridSegmentButtonTextActive: {
      color: '#ffffff',
      fontWeight: '800',
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
