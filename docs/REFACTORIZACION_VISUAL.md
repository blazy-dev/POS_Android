# Refactorización Visual — Aplicación Móvil (Estilo Shadcn UI)

Este documento detalla los lineamientos de diseño y arquitectura de la refactorización visual de la aplicación móvil de **POS SaaS**, con el fin de alinearla con la estética moderna y minimalista del frontend web (Next.js con Tailwind CSS).

## 1. Objetivos del Rediseño

* **Consistencia visual con la Web**: Imitar el look and feel de **Shadcn UI** en la aplicación React Native, utilizando componentes limpios y paletas basadas en grises planos (`zinc` / `slate`).
* **Alto Contraste y Usabilidad**: Asegurar que los botones principales sean fáciles de identificar y operar (CTAs sólidos) y que los textos posean máxima legibilidad.
* **Estabilidad Técnica**: Construir la interfaz de manera nativa utilizando `StyleSheet` de React Native optimizado con los tokens del theme, previniendo conflictos de dependencias en React 19 y Expo Go.

---

## 2. Sistema de Colores (Paleta Zinc de Tailwind)

El theme móvil de la aplicación se rediseña utilizando los siguientes valores de color en hexadecimal para ambos modos:

### Modo Oscuro (Fondo Zinc-950)
* **Fondo general**: `#09090b` (`zinc-950`)
* **Superficies / Tarjetas**: `#18181b` (`zinc-900`)
* **Bordes / Líneas**: `#27272a` (`zinc-800`)
* **Texto Principal**: `#fafafa` (`zinc-50`)
* **Texto Secundario**: `#a1a1aa` (`zinc-400`)
* **Color de Acento (Primary)**: `#ffffff` (Botón principal sólido) o `#0497bf` (Celeste de marca sutil para acentos).

### Modo Claro (Fondo Blanco)
* **Fondo general**: `#ffffff` (Blanco puro)
* **Superficies / Tarjetas**: `#fafafa` (`zinc-50`)
* **Bordes / Líneas**: `#e4e4e7` (`zinc-200`)
* **Texto Principal**: `#18181b` (`zinc-900`)
* **Texto Secundario**: `#71717a` (`zinc-500`)
* **Color de Acento (Primary)**: `#18181b` (Botón principal sólido) o `#0497bf` (Celeste de marca sutil).

---

## 3. Guía de Componentes Atómicos (Estética Shadcn)

### Botones (`Button.tsx`)
Los botones abandonan los colores de fondo difusos o traslúcidos. Sus estilos son:
* **Primary (Acciones principales)**:
  * *Dark Mode*: Fondo blanco sólido, texto negro sólido.
  * *Light Mode*: Fondo negro sólido, texto blanco sólido.
* **Secondary**: Fondo gris sutil (`zinc-100` en claro, `zinc-800` en oscuro) y texto contrastante.
* **Outline**: Fondo transparente con un borde muy fino de 1px (`zinc-200` o `zinc-800`).
* **Destructivo**: Fondo rojo sólido con texto blanco.

### Campos de Texto (`FormField.tsx`)
* Los campos de texto imitan el input de Shadcn: fondo transparente o muy leve, esquinas suavemente redondeadas (8px) y un borde sutil de 1px.
* Al enfocarse, el borde cambia a un tono contrastante (`zinc-900` en claro, `zinc-100` en oscuro), simulando el foco clásico.

### Badges (`Badge.tsx`)
* Pills pequeñas con bordes de 1px, fondos semitraslúcidos de color semántico (verde, rojo, naranja) y texto a color en negrita de alta visibilidad.

---

## 4. Estructuración y Layouts

* **Layouts Planos**: Eliminación de gradientes difusos y sombreado 3D de botones. El contraste se logra exclusivamente a través del color y los grosores de línea de 1px.
* **Separadores**: Líneas de 1px en `zinc-200` (claro) y `zinc-800` (oscuro) para delimitar de manera organizada listas, tablas de compra y configuraciones.
* **Modales / Diálogos**: El modal de checkout en el POS se rediseña como un contenedor flotante sólido con bordes definidos y fondo opaco, emulando los componentes `Dialog` de la interfaz web.
