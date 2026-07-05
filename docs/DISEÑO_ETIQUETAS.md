# Personalización Dinámica de Etiquetas de Góndola

Este documento describe la especificación de diseño, opciones de estructura y el motor de compilación para la impresión de etiquetas personalizables.

---

## 1. Especificaciones de Configuración (`LabelConfig`)

La plantilla de etiqueta se define mediante un objeto de configuración que controla la visibilidad, tamaño e ícono de cada sección:

```typescript
export interface LabelConfig {
  // Configuración del Logo
  showLogo: boolean;
  logoSize: 'sm' | 'md' | 'lg';        // sm: 16px, md: 24px, lg: 32px
  logoType: 'shopping' | 'business' | 'ticket'; // Shopping cart, Briefcase, Receipt

  // Configuración del Nombre de Producto
  namePosition: 'top' | 'middle' | 'bottom';
  nameSize: 'sm' | 'md' | 'lg';        // sm: 11px, md: 14px, lg: 18px

  // Configuración de Código de Barras
  showBarcode: boolean;
  barcodePosition: 'top' | 'middle' | 'bottom';
  barcodeHeight: 'sm' | 'md' | 'lg';   // sm: 20px, md: 35px, lg: 50px

  // Configuración del Precio
  pricePosition: 'top' | 'middle' | 'bottom';
  priceSize: 'sm' | 'md' | 'lg';       // sm: 14px, md: 20px, lg: 26px
}
```

---

## 2. Motor de Layout (Distribución en Secciones)

Para evitar colisiones entre elementos al posicionarlos (por ejemplo, que el Nombre y el Precio queden encima uno del otro si ambos están en "arriba"), el motor divide la etiqueta en tres contenedores lógicos ordenados de forma vertical (`flexDirection: 'column'`):

1. **Contenedor Superior (`top`)**: Agrupa y renderiza todos los elementos configurados en la posición `'top'`.
2. **Contenedor Medio (`middle`)**: Agrupa y renderiza todos los elementos configurados en la posición `'middle'`.
3. **Contenedor Inferior (`bottom`)**: Agrupa y renderiza todos los elementos configurados en la posición `'bottom'`.

### Reglas de Desempate (Orden de Apilado Interno)
Si dos o más elementos coinciden en el mismo contenedor (por ejemplo, el usuario asignó Nombre y Precio a la posición `top`), se apilan verticalmente siguiendo este orden interno predeterminado:
1. **Logo** (siempre al inicio de su contenedor asignado).
2. **Nombre del Producto**.
3. **Precio de Venta**.
4. **Código de Barras** (siempre al final de su contenedor asignado).

---

## 3. Motor de Compilación HTML/CSS a PDF

El generador final compila las propiedades de `LabelConfig` a código HTML y estilos CSS en un formato de grilla para hojas A4.

### Mapeo de Fuentes y Medidas

| Atributo | Nivel | Medida en React Native | Equivalente en CSS (PDF) |
| :--- | :--- | :--- | :--- |
| **Tamaño Nombre** | `sm` | 11 px | `11px` |
| | `md` | 14 px | `14px` |
| | `lg` | 18 px | `18px` |
| **Tamaño Precio** | `sm` | 14 px | `14px` |
| | `md` | 20 px | `20px` |
| | `lg` | 26 px | `26px` |
| **Altura Código** | `sm` | 20 px | `20px` |
| | `md` | 35 px | `35px` |
| | `lg` | 50 px | `50px` |
| **Tamaño Logo** | `sm` | 16 px | `16px` |
| | `md` | 24 px | `24px` |
| | `lg` | 32 px | `32px` |

### Grilla de Impresión A4
El PDF final se divide en una grilla CSS Grid de 3 columnas:
```css
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8mm;
}
.label-card {
  height: 42mm;
  box-sizing: border-box;
  page-break-inside: avoid;
}
```
Esto asegura que las dimensiones impresas sean perfectamente consistentes con los tamaños de etiquetas estándar de góndola.
