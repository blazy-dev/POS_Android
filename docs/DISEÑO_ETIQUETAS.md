# Personalización de Etiquetas mediante Arrastre Táctil (Drag & Drop) y Dimensiones Físicas

Este documento describe la especificación técnica, el modelo de posicionamiento absoluto libre en dos dimensiones (XY) y el cálculo de escala para la impresión de etiquetas personalizables.

---

## 1. Especificaciones de Configuración (`LabelConfig`)

La plantilla de etiqueta se define mediante un objeto de configuración que controla las coordenadas físicas, los tamaños en pixeles y las dimensiones de la etiqueta:

```typescript
export interface LabelConfig {
  // Dimensiones físicas de la etiqueta
  labelSize: 'standard' | 'small' | 'large';

  // Configuración del Nombre de Producto
  nameSize: number;       // Tamaño de fuente en px (rango: 10 a 24)
  nameX: number;          // Coordenada X en px relativa al preview
  nameY: number;          // Coordenada Y en px relativa al preview

  // Configuración de Código de Barras
  showBarcode: boolean;
  barcodeHeight: number;  // Altura en px (rango: 15 a 70)
  barcodeX: number;       // Coordenada X en px relativa al preview
  barcodeY: number;       // Coordenada Y en px relativa al preview

  // Configuración del Precio de Venta
  priceSize: number;      // Tamaño de fuente en px (rango: 12 a 36)
  priceX: number;         // Coordenada X en px relativa al preview
  priceY: number;         // Coordenada Y en px relativa al preview
}
```

---

## 2. Dimensiones y Relación de Aspecto de Etiquetas

El sistema admite tres tamaños físicos para etiquetas de góndola:

| Plantilla | Ancho físico | Alto físico | Relación de aspecto | Ancho/Alto de Preview (px) |
| :--- | :--- | :--- | :--- | :--- |
| **Estándar (Góndola)** | `70 mm` | `42 mm` | `1.66` | `250 px` x `150 px` |
| **Chica (Precios)** | `50 mm` | `30 mm` | `1.66` | `250 px` x `150 px` |
| **Grande (Destacados)** | `90 mm` | `60 mm` | `1.50` | `250 px` x `166 px` |

---

## 3. Modelo de Gestos (`PanResponder`) y Posicionamiento Absoluto

Cada elemento visible en el preview de la etiqueta (Nombre, Precio, Código de Barras) se comporta como un nodo de posicionamiento absoluto (`position: 'absolute'`) y está vinculado a un controlador de gestos nativo (`PanResponder`).

Al arrastrar un elemento con el dedo:
1. Las coordenadas locales `(x, y)` del elemento se actualizan dinámicamente en el estado `config` basándose en el delta del gesto.
2. Se aplican límites de contorno (`clamping`) para evitar que el elemento se arrastre fuera del área activa de la etiqueta.
3. El ancho del elemento de previsualización se calcula de forma centralizada para que no se desborde del borde derecho.

---

## 4. Traducción Proporcional al PDF Final (Consistencia HTML)

Para asegurar que lo que el usuario ve en la pantalla se reproduzca con total fidelidad en el papel impreso (sin importar la resolución del celular o el tamaño de la etiqueta), el motor de compilación calcula las **posiciones proporcionales en porcentaje (%)** de cada elemento respecto al contenedor del preview:

$$\text{Posición X (\%)} = \left( \frac{\text{X del elemento}}{\text{Ancho del Preview}} \right) \times 100$$
$$\text{Posición Y (\%)} = \left( \frac{\text{Y del elemento}}{\text{Alto del Preview}} \right) \times 100$$

### Ejemplo de Estilo HTML Dinámico
Cada etiqueta de la grilla PDF se maqueta con posicionamiento absoluto relativo a su contenedor base:

```css
.label-card {
  position: relative;
  width: 70mm;  /* Dinámico según labelSize */
  height: 42mm; /* Dinámico según labelSize */
  box-sizing: border-box;
}
.label-name {
  position: absolute;
  left: 20%;    /* Dinámico según nameX */
  top: 15%;     /* Dinámico según nameY */
  font-size: 13px; /* Dinámico según nameSize */
}
```
Esto garantiza que, al imprimir en A4, el layout de la etiqueta de góndola conserve la misma distribución elegida visualmente con el dedo por el usuario.
