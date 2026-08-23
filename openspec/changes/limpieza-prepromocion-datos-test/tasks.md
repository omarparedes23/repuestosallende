# Tasks — limpieza-prepromocion-datos-test

- [x] 1. Contrastar tablas, FK y trigger con las migraciones.
- [x] 2. Incluir ventas, compras, órdenes, tesorería, cajas, kardex y auditorías.
- [x] 3. Añadir guardas de productos, maestros, saldos, perfiles y `auth.users`.
- [ ] 4. Confirmar backup/snapshot con fecha, hora y responsable.
- [ ] 5. Activar mantenimiento y confirmar ausencia de escrituras concurrentes.
- [ ] 6. Ejecutar `DRY_RUN=on` y revisar conteos, rollback y guardas.
- [ ] 7. Autorizar y ejecutar `DRY_RUN=off` en una sesión separada.
- [ ] 8. Verificar read-only tablas vacías, maestros conservados y trigger activo.
- [ ] 9. Cargar stock/costos iniciales antes de habilitar operaciones reales.

Las tareas 6–9 son secuenciales. No hay ejecución real sin completar 4–6.
