# Tareas — reportes de ventas y cobros

## Fase 0 — Preflight de lectura

- [ ] 0.1 Verificar esquema remoto, tipos manuales, RLS e índices de
  `ra_ventas`, `ra_venta_pagos` y CxC sin mutar datos.
- [ ] 0.2 Medir volumen y plan de consulta para definir paginación y confirmar
  si los índices actuales bastan.
- [ ] 0.3 Confirmar valores históricos de `sucursal_id`, moneda, estados de
  venta/SUNAT y métodos de pago.
- [ ] 0.4 Cerrar definición de `credito_original` para pagos mixtos y contratos
  legacy, sin alterar registros.

## Fase 1 — Contratos y pruebas de consulta

- [ ] 1.1 Definir schemas Zod de filtros, paginación y respuesta tipada.
- [ ] 1.2 Escribir pruebas de agregación: una venta con varios pagos y varios
  abonos no se multiplica.
- [ ] 1.3 Escribir prueba de cobro efectivo: abono + movimiento de caja cuenta
  solo una vez en `Cobros registrados`.
- [ ] 1.4 Escribir pruebas PEN/USD separados, histórico sin sucursal y estados
  fiscal pendiente/error visibles.
- [ ] 1.5 Escribir matriz de autorización por rol, empresa y sucursal.

## Fase 2 — Consultas de servidor

- [ ] 2.1 Implementar consulta paginada de ventas y sus agregados financieros.
- [ ] 2.2 Implementar consulta paginada de abonos CxC para cobros registrados.
- [ ] 2.3 Validar filtros y derivar empresa/sucursales desde sesión; no confiar
  en parámetros de cliente como autoridad.
- [ ] 2.4 Añadir o ajustar tipos en `src/lib/types/database.ts` solo si el
  preflight demuestra que son necesarios.
- [ ] 2.5 Proponer migración separada únicamente si la evidencia de rendimiento
  la justifica; no aplicarla sin autorización.

## Fase 3 — Panel Ventas

- [ ] 3.1 Crear ruta y enlace de navegación `Panel → Ventas`.
- [ ] 3.2 Implementar filtros, KPIs por moneda y tabla paginada.
- [ ] 3.3 Mostrar pagos, crédito, cobros posteriores y saldo por documento sin
  mezclar totales comerciales con cobros.
- [ ] 3.4 Distinguir sucursal de venta, estado comercial y estado SUNAT.
- [ ] 3.5 Enlazar al detalle autorizado del comprobante.

## Fase 4 — Tesorería → Cobros registrados

- [ ] 4.1 Conservar el comportamiento actual en pestaña `Por cobrar`.
- [ ] 4.2 Añadir pestaña `Cobros registrados` con filtros, KPIs y paginación.
- [ ] 4.3 Mostrar comprobante, cliente, sucursal receptora, método, referencia,
  caja y usuario disponibles; representar nulos históricos explícitamente.
- [ ] 4.4 Verificar que una deuda liquidada no aparezca en `Por cobrar` pero que
  sus abonos sigan visibles en el historial.

## Fase 5 — Verificación y entrega

- [ ] 5.1 Ejecutar pruebas Vitest nuevas y la suite existente.
- [ ] 5.2 Ejecutar lint enfocado de archivos modificados y reportar deuda previa
  por separado.
- [ ] 5.3 Ejecutar QA autenticado con venta contado, venta a crédito parcial,
  cobro total posterior y cobro efectivo.
- [ ] 5.4 Validar invariantes de doble conteo, filtros de sucursal y separación
  de monedas con evidencia de base TEST.
- [ ] 5.5 Registrar un `verify-report.md` requisito→prueba→resultado antes de
  considerar el cambio terminado.
