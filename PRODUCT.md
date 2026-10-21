# PRODUCT.md - ParrillaPay

## 1. Visión General
**ParrillaPay** es una Web App (Mobile First / PWA) diseñada para gestionar, dividir y saldar los gastos de eventos sociales. Permite planificar compras, excluir a usuarios de ciertos cobros y liquidar deudas de forma rápida integrando Inteligencia Artificial (Claude API) para la lectura y validación automática de comprobantes de transferencia y boletas de supermercado.

## 2. Arquitectura y Stack Tecnológico
*   **Frontend:** Web App Mobile First (React.js / Next.js). Optimizada para uso en navegadores móviles (390x844px) sin necesidad de instalación.
*   **Backend:** Node.js con Express.js (ligero y rápido para la API).
*   **Base de Datos:** PostgreSQL (gestión de usuarios, eventos, productos y deudas).
*   **Integración IA:** Claude API (Procesamiento de imágenes para extracción de datos en boletas de compra y comprobantes de transferencia bancaria).
*   **Infraestructura y Despliegue:** Render (PaaS) utilizando el subdominio gratuito `parrillapay.onrender.com`.

## 3. Lógica de Negocio y Flujos Principales

### A. Gestión de Usuarios y Eventos
*   **Autenticación:** Sistema de cuentas con registro para mantener historial de eventos y deudas pendientes.
*   **Ingreso a la Junta:** El anfitrión crea el evento y comparte el enlace de Render o un código QR. Los invitados se registran/loguean en la Web App para unirse a la sala.

### B. Planificación y Perfiles de Consumo
*   **Calculadora de Insumos:** Herramienta para estimar cantidades necesarias según el número de asistentes.
*   **Etiquetas de Exclusión:** Capacidad de etiquetar usuarios (ej. "No bebe alcohol", "Vegetariano") y productos (ej. "Cervezas", "Carne"). El sistema excluye automáticamente a estos usuarios al calcular su cuota.
*   **Desglose Simple:** La aplicación muestra exactamente quién compró qué, y el desglose bruto de cuánto debe pagar cada participante al fondo común o al anfitrión.

### C. Sistema de Pagos y Liquidación (Validación con IA)
El pago se realiza por fuera de la plataforma (transferencia bancaria directa al anfitrión) y se valida internamente mediante IA:
1. El usuario transfiere desde la app de su banco y toma un pantallazo del comprobante.
2. En ParrillaPay, sube la imagen mediante un `<input type="file">`.
3. El frontend envía la imagen a Express, quien construye un prompt estricto y la envía a la API de Claude.
4. Claude extrae el monto, nombre/RUT del emisor, destinatario y fecha, devolviendo un JSON estructurado.
5. Express cruza los datos con la base de datos de PostgreSQL, valida que el monto coincida con la deuda y actualiza el estado a `pagado` (o `pendiente de confirmación` si hay discrepancias).

### D. Ingreso de Gastos (Boletas de Supermercado)
*   Cualquier participante que haya comprado insumos sube la foto de la boleta.
*   La API de Claude procesa la imagen, listando los ítems, precios y el total, sumando este monto al crédito del usuario que realizó la compra para descontarlo de su cuota.

## 4. Próximos Pasos para Desarrollo
1.  Diseñar el modelo relacional (DER) en PostgreSQL (Usuarios, Eventos, Gastos, Items, Deudas).
2.  Levantar el boilerplate de Express.js y configurar el endpoint de recepción de imágenes con Multer.
3.  Definir y probar los System Prompts de Claude en la consola de Anthropic para garantizar que devuelva JSONs predecibles al leer comprobantes.
4.  Diseñar las vistas en Figma enfocadas 100% en proporciones móviles siguiendo el DESIGN.md.
5.  Configurar el pipeline de despliegue continuo en Render.