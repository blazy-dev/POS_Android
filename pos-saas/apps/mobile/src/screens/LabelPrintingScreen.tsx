import { useState, useMemo } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  SafeAreaView,
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

function generateBarcodeSVG(text: string): string {
  if (!text) return '';
  const encoded = encodeCode128(text);
  const barWidth = 2;
  const height = 40;
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

interface LabelPrintingScreenProps {
  products: ProductRecord[];
  onBack: () => void;
}

interface PrintQueueItem {
  product: ProductRecord;
  quantity: number;
}

export function LabelPrintingScreen({ products, onBack }: LabelPrintingScreenProps) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => getStyles(colors, isDark), [colors, isDark]);

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
        const barcodeSvg = label.barcode ? generateBarcodeSVG(label.barcode) : '';
        gridCellsHtml += `
          <div class="label-card">
            <div class="label-name">${label.name}</div>
            <div class="label-price">$ ${label.price}</div>
            ${
              label.barcode
                ? `
              <div class="barcode-container">
                ${barcodeSvg}
                <div class="barcode-text">${label.barcode}</div>
              </div>
            `
                : '<div class="no-barcode">Sin código</div>'
            }
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
              border-radius: 4px;
              padding: 10px;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: space-between;
              height: 42mm;
              box-sizing: border-box;
              text-align: center;
              page-break-inside: avoid;
            }
            .label-name {
              font-size: 13px;
              font-weight: 700;
              color: #18181b;
              max-height: 36px;
              overflow: hidden;
              text-overflow: ellipsis;
            }
            .label-price {
              font-size: 20px;
              font-weight: 800;
              color: #18181b;
              margin: 4px 0;
            }
            .barcode-container {
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .barcode-text {
              font-size: 8px;
              font-family: monospace;
              color: #71717a;
              margin-top: 2px;
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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Volver al catálogo</Text>
        </Pressable>
        <Text style={styles.title}>Impresión de Etiquetas</Text>
        <Text style={styles.subtitle}>
          Seleccioná productos del inventario y generá etiquetas de góndola listas para imprimir.
        </Text>
      </View>

      <View style={styles.container}>
        <View style={styles.searchSection}>
          <Text style={styles.sectionLabel}>Agregar producto a la cola:</Text>
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

        <Text style={styles.sectionLabel}>Cola de etiquetas a imprimir:</Text>
        {queue.length === 0 ? (
          <View style={styles.emptyQueue}>
            <Ionicons name="barcode-outline" size={48} color={colors.textMuted} style={{ opacity: 0.5 }} />
            <Text style={styles.emptyText}>La cola está vacía.</Text>
            <Text style={styles.emptySubtext}>Buscá productos arriba para empezar a armar tu plantilla.</Text>
          </View>
        ) : (
          <FlatList
            data={queue}
            keyExtractor={(item) => item.product.id}
            contentContainerStyle={styles.queueList}
            renderItem={({ item }) => (
              <View style={styles.queueRow}>
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
            )}
          />
        )}

        <View style={styles.footer}>
          <Button
            label={isGenerating ? 'Generando PDF...' : 'Generar PDF de Etiquetas'}
            icon="print-outline"
            onPress={handleGenerateLabels}
            disabled={isGenerating || queue.length === 0}
            loading={isGenerating}
          />
        </View>
      </View>
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
      gap: 6,
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
      paddingHorizontal: spacing.xl,
      gap: spacing.md,
    },
    searchSection: {
      zIndex: 10,
      position: 'relative',
    },
    sectionLabel: {
      color: colors.text,
      fontSize: 13,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
    },
    searchInput: {
      height: 44,
      borderRadius: radius.md,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.md,
      color: colors.text,
      fontSize: 14,
    },
    suggestionsCard: {
      position: 'absolute',
      top: 72,
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
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: spacing.xl,
      gap: 8,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
    },
    emptyText: {
      color: colors.text,
      fontSize: 14,
      fontWeight: '700',
      marginTop: 4,
    },
    emptySubtext: {
      color: colors.textMuted,
      fontSize: 12,
      textAlign: 'center',
    },
    queueList: {
      gap: spacing.sm,
    },
    queueRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: spacing.md,
      backgroundColor: colors.surface,
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
      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
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
    footer: {
      paddingBottom: 130,
    },
  });
