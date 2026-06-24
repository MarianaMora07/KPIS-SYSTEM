# Checklist HU-KPI-012 — Verificación manual

Usar tras desplegar la fusión del módulo de auditoría.

| # | Caso | Pasos | Resultado esperado | Estado |
|---|------|-------|-------------------|--------|
| 1 | Crear KPI | Crear KPI desde `/kpis` | Log `crear`, entidad `kpis`, diff en `/auditoria` | Pendiente QA |
| 2 | Editar KPI | Modificar nombre o meta | Log `actualizar`, diff campo a campo visible | Pendiente QA |
| 3 | Eliminar meta | Eliminar `kpi_target` | Log `eliminar` en bitácora | Pendiente QA |
| 4 | Cambiar estado plan | Actualizar estado en `/alertas/planes/[id]` | Log `actualizar` + evento en timeline | Pendiente QA |
| 5 | Importar valores | Importar archivo | `import_jobs.usuario_id` poblado | Pendiente QA |
| 6 | Usuario consulta | Login como `consulta` | Sin acceso a `/auditoria` (redirect) | Pendiente QA |
| 7 | Director / auditoria.ver | Login director o rol con permiso | Acceso lectura `/auditoria` | Pendiente QA |
| 8 | Inmutabilidad | `UPDATE audit_logs SET ...` en SQL | Error por `trg_audit_logs_immutable` | Pendiente QA |

## Rutas clave

- Bitácora global: `/auditoria`
- Enlace desde Seguridad: `/seguridad` → «Ver bitácora de auditoría completa»
- Timeline plan: `/alertas/planes/[id]`
- Integraciones resumen: `/integraciones` → panel «Últimas sincronizaciones»

## Infraestructura

- Migración `20250624000001_audit_user_context.sql`: RPC `set_audit_user_context`
- Atribución sync manual: `processIntegrationSync(..., { triggeredByUserId })`
- Cron sin usuario: logs con badge **SISTEMA**
