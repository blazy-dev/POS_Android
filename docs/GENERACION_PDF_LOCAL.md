# Generación de PDF y Etiquetas Físicas (Local-First)

Este documento describe la arquitectura y el funcionamiento técnico de la exportación de reportes, catálogos e impresión de etiquetas en formato PDF dentro de la aplicación móvil de POS SaaS.

---

## 1. Arquitectura Local-First (Seguridad & Rendimiento)

A diferencia de las arquitecturas web tradicionales donde la generación de PDFs se delega a un servicio en el backend (ej. Puppeteer, PDFKit o Node APIs), en este POS móvil la generación es **100% Cliente-Local**.

### Ventajas Técnicas:
1. **Evita la Saturación del Servidor:** Al no realizar llamadas de red de tipo HTTP POST con payloads pesados para renderizar PDFs, la infraestructura del servidor queda liberada de tareas intensivas de CPU.
2. **Privacidad de Datos Absoluta:** Los catálogos, resúmenes financieros y precios son procesados en la memoria de la aplicación móvil. No viajan por Internet, previniendo filtraciones de datos comerciales.
3. **Persistencia Temporal y Autolimpiable:** Los documentos se almacenan temporalmente en la caché del dispositivo (`FileSystem.cacheDirectory`). Una vez que el sistema operativo gestiona el archivo (compartido o impreso), el recolector de basura de caché del sistema los elimina automáticamente.
4. **Funcionamiento Offline:** El comerciante puede exportar sus inventarios y reportes diarios a PDF en el depósito, sótano o rutas rurales sin requerir cobertura de red móvil.

---

## 2. Tecnologías y Módulos Utilizados

- **`expo-print`**: Permite inyectar plantillas HTML responsivas y renderizarlas en un motor WebView local silencioso para producir archivos binarios PDF.
- **`expo-sharing`**: Provee el puente nativo con el sistema operativo para invocar el "Share Sheet" (panel de compartir). Esto le permite al usuario enviar el PDF vía WhatsApp, email, Telegram, o enviarlo directamente a imprimir en cualquier impresora Wi-Fi o Bluetooth enlazada a su teléfono.

---

## 3. Generador de Códigos de Barra Offline (CODE128)

Para lograr la impresión de etiquetas de góndola de forma totalmente autónoma y offline (sin consumir APIs de imágenes de códigos de barra externos), el sistema cuenta con un codificador matemático nativo:

- **Archivo:** [LabelPrintingScreen.tsx](file:///c:/Users/juanj/Desktop/Proyecto%20POS%20global/POS_Android/pos-saas/apps/mobile/src/screens/LabelPrintingScreen.tsx)
- **Función `encodeCode128`**: Traduce cualquier cadena alfanumérica (barcode del producto) a su equivalente binario en base a la especificación estándar de simbología de código de barras CODE128 (Code B).
- **Función `generateBarcodeSVG`**: Convierte la cadena binaria en un elemento gráfico vectorial (`<svg>`) compuesto por rectángulos negros y blancos.
- Este SVG se inyecta directamente inline en la plantilla HTML que procesa `expo-print`, asegurando nitidez absoluta al imprimir físicamente en papel de etiquetas, evitando pixelado.

---

## 4. Estilos y Estética (Shadcn/Zinc)

Las plantillas HTML inyectadas imitan la guía visual del proyecto:
- **Catálogos y Reportes:** Estructurados con tablas minimalistas usando la paleta de colores Zinc (encabezados de tabla en `#f4f4f5`, textos principales `#18181b`, textos muted `#71717a`).
- **Etiquetas de Góndola:** Diseñadas en cuadrículas de 3 columnas optimizadas para hojas tamaño A4 estándar con bordes discontinuos que sirven de guía para el corte manual.
- **Control de Paginación en PDF:** Se aplica la regla CSS `page-break-inside: avoid;` en cada fila de productos y tarjetas de etiquetas para evitar cortes horizontales antiestéticos a la mitad de una línea o código de barras al cambiar de página.
