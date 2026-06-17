# Guion de demo — Sistema KPIs Estelar

Duración estimada: 20–25 minutos. Un paso por HU del PDF.

## HU-KPI-006 / HU-KPI-007 — Dashboard y tendencias (2 min)

- `/dashboard` con filtros región/hotel.
- Tarjetas con semáforo, comparativos mes/año, top críticos.
- Gráfico de tendencias con proyección lineal etiquetada como **estimación**.
- Drill-down al hacer clic en una tarjeta.

## HU-KPI-001 — Crear indicador comercial (3 min)

- `/kpis` → Crear KPI con catálogo completo (hotel, región, canal, campaña, equipo).
- Validación de campos obligatorios en español.
- Detalle `/kpis/[id]`: badge estado activo/inactivo.
- Editar (genera versión en historial), duplicar (`-COPY`), inactivar con modal de confirmación.

## HU-KPI-002 — Metas y cumplimiento (2 min)

- En detalle KPI: metas por periodo (mensual, trimestral, semestral, anual, especial).
- Meta opcional por hotel/región.
- Configurar rangos semáforo (carga rangos existentes).
- Registrar valor → clasificación automática cumplimiento/riesgo/incumplimiento.

## HU-KPI-003 — Fórmulas y variables (3 min)

Solo **administrador** configura variables y fórmulas en el detalle del KPI.

1. **Variables simples:** `visitas_mes`, `reservas_web` (código único; error si duplicado).
2. **Variable compuesta (opcional):** `tasa_bruta` con fórmula `reservas_web / visitas_mes`.
3. **Fórmula del KPI:** `reservas_web / visitas_mes * 100` → validar y guardar.
4. **Registrar valor:** campos por variable (`visitas_mes=1000`, `reservas_web=25`) → guarda `2.5%` y muestra entradas en el listado.
5. **Import:** plantilla con columnas `var_visitas_mes`, `var_reservas_web` para `CNV-001`.

**Fase 2 (pendiente):** indicadores derivados con sintaxis `kpi("CODIGO")`.

## HU-KPI-004 — Importar Excel (2 min)

- `/import` → plantilla carga **valores** (`kpi_values`), no definición de KPIs.
- Validación de columnas obligatorias antes de subir.
- Job async con errores detallados por fila.

## HU-KPI-005 — Integraciones externas (2 min)

- `/integraciones` → crear PMS demo, sincronizar.
- Ver jobs y logs por job.
- Fallo de conexión: reintentos + webhook `integration.failed` (Activepieces).

## HU-KPI-008 — Alertas automáticas (2 min)

- Valor en riesgo → alerta activa + campana in-app.
- Incumplimiento crítico → escalamiento automático + evento `kpi.alert.escalated`.
- Correo vía workflow Activepieces (`kpi.alert.created` / `kpi.alert.escalated`).

## HU-KPI-009 — Planes de acción (2 min)

- `/alertas` → crear plan desde alerta con responsable y fecha compromiso.
- Seguimiento de ítems y estados en pestaña Planes.

## HU-KPI-010 — Reportes ejecutivos (2 min)

- `/reportes` → vista previa, exportar PDF/Excel/PowerPoint.
- Programar reporte semanal desde UI (`scheduled_reports`).
- Cron `POST /api/cron/reports` → evento `report.scheduled`.

## HU-KPI-011 — Usuarios y permisos (2 min)

- `/seguridad` → roles, scopes hotel/región.
- Sidebar y acciones ocultas según permiso (`kpis.crear`, `reportes.exportar`, etc.).
- Gerente hotel solo ve datos de su hotel (RLS).

## HU-KPI-012 — Auditoría (1 min)

- Editar KPI / integración / plan → fila en bitácora.
- Filtros por entidad, usuario y fecha en `/seguridad`.

## Cierre

- `npm run build` limpio.
- Supabase + migraciones aplicadas.
- Activepieces configurado en `.env.local`.
