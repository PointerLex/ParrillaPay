# DESIGN.md - ParrillaPay (Design System & UI/UX)

## 1. Filosofía de Diseño
ParrillaPay utiliza un enfoque **Mobile First** estricto, diseñado para sentirse como una aplicación nativa desde el navegador (PWA). La estética es **Minimalista y Monocromática (Dark Theme por defecto)**, priorizando la legibilidad de los datos financieros (quién debe a quién) mediante el uso de altos contrastes, tipografía clara y ausencia de ruido visual.

## 2. Paleta de Colores (Monocromática)
El sistema se basa en la escala de grises de Tailwind CSS (familia `zinc`), eliminando colores de acento para dar un aspecto premium, nocturno e industrial.

*   **Fondo Base (App Background):** `bg-black` o `bg-zinc-950`.
*   **Superficies (Cards, Modales, Bottom Sheets):** `bg-zinc-900` a `bg-zinc-900/50`.
*   **Bordes (Separadores visuales sin usar sombras):** `border-zinc-800` o `border-zinc-900`.
*   **Texto Principal (Títulos, Montos, Nombres):** `text-white` o `text-zinc-50`.
*   **Texto Secundario (Fechas, Etiquetas, Descripciones):** `text-zinc-400` a `text-zinc-500`.
*   **Llamado a la Acción (CTA Principal):** Máximo contraste. Fondo blanco con texto negro (`bg-white text-black`).
*   **Estados Semánticos:** 
    *   *Éxito / Pagado:* Se indica con opacidad reducida (`text-zinc-500`) y un ícono de check (sin usar verde).
    *   *Pendiente:* Texto primario brillante (`text-white`).

## 3. Tipografía
*   **Fuente Principal:** Sans-serif moderna y geométrica (ej. `Inter`, `Roboto` o `Geist`).
*   **Jerarquía:**
    *   *Montos Totales:* Gigantes y en negrita (ej. `text-5xl font-bold tracking-tighter`).
    *   *Títulos de Sección:* Pequeños, en mayúsculas y espaciados (ej. `text-sm font-semibold uppercase tracking-widest`).
    *   *Datos del usuario:* Tamaño estándar con peso medio (ej. `text-base font-medium`).

## 4. Componentes Clave (UI Kit)

### A. Botones (Buttons)
*   **Primario (Solid):** Contraste invertido. `bg-white text-black rounded-xl`. Uso: "Subir comprobante", "Pagar".
*   **Secundario (Outline):** Borde sutil. `border border-zinc-700 text-white rounded-xl`. Uso: "Ver detalle".
*   **Terciario (Ghost):** Sin fondo. `text-zinc-400 hover:text-white`. Uso: "Cancelar", "Volver".

### B. Tarjetas (Cards)
*   **Estructura:** Bordes redondeados (`rounded-2xl`), borde sólido fino (`border-1 border-zinc-800`), padding interno generoso (`p-4` o `p-5`).
*   **Sombra:** Inexistente. La separación se logra por la diferencia sutil de grises entre el fondo de la app y la tarjeta.

### C. Navegación (Bottom Navigation Bar)
*   **Ubicación:** Fija en la parte inferior (`fixed bottom-0`).
*   **Estilo:** Fondo semi-transparente con desenfoque (`bg-black/90 backdrop-blur-xl`).
*   **Estructura:** 4 íconos inactivos (`text-zinc-500`) y 1 botón de acción central flotante (FAB) para la acción principal: **Subir Boleta/Gasto**.

## 5. Arquitectura de Pantallas (Vistas)

1.  **Onboarding / Login:**
    *   Logo tipográfico simple ("ParrillaPay").
    *   Input gigante para ingresar "Código de Junta".
    *   Botón "Crear nueva junta" (requiere login).

2.  **Dashboard (Mis Asados):**
    *   Lista de tarjetas con eventos activos e históricos.
    *   Cada tarjeta muestra: Nombre, Fecha, y Estado (Deuda pendiente vs Todo pagado).

3.  **Sala del Evento (Main View):**
    *   *Header:* Nombre del evento, cantidad de personas (sticky top).
    *   *Tab Navigation:* Navegación en píldoras (Pills) para alternar entre "Resumen", "Gastos" y "Personas".
    *   *Tab Resumen:* Muestra el costo total gigante en el centro y las tarjetas de deudas directas abajo ("Le debes a X").
    *   *Tab Gastos:* Feed cronológico estilo chat o timeline de las boletas subidas.

4.  **Cámara / Escáner (Integración Claude):**
    *   Interfaz inmersiva. El visor de la cámara ocupa toda la pantalla.
    *   Recuadro delimitador en el centro para enmarcar la boleta o comprobante.
    *   Controles minimalistas (Flash, Cambiar Cámara, Disparador blanco grande).

5.  **Modal de Liquidación (Bottom Sheet):**
    *   Al presionar "Pagar", sube una ventana desde abajo (evitando cambiar de página).
    *   Muestra el monto a transferir, el banco y RUT del destinatario.
    *   Incluye el botón de carga del archivo (Screenshot) para procesar con IA.