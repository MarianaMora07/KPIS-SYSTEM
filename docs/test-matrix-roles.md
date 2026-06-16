# Matriz de prueba por rol (HU-KPI-011)

Fuente operativa alineada con el PDF de requerimientos y `lib/auth/role-matrix.ts`.

Usuarios de prueba: registrarse en `/login` y asignar rol desde `/seguridad` (solo **administrador** puede asignar roles).

| Rol | Dashboard | KPIs crear/editar | Import | Integraciones | Reportes export | Seguridad/Catálogo | Scope esperado |
|-----|-----------|-------------------|--------|---------------|-----------------|-------------------|----------------|
| administrador | Sí | Sí (crear + editar + inactivar) | Sí | Sí | Sí | Sí (gestión completa) | Todos los hoteles |
| director_comercial | Sí | Sí | Sí | Sí | Sí | No | Todos |
| director_mercadeo | Sí | Sí | Sí | **No** | Sí | No | Todos |
| gerente_hotel | Sí | **Editar*** (definición + metas/valores) | Sí | No | Sí | No | Solo hotel asignado |
| analista | Sí | Sí | Sí | Sí | Sí | Sí (**solo lectura**) | Según scopes |
| consulta | Sí | No | No | No | Sí | No | Solo lectura |

\* Asignar `user_hotel_scopes` al gerente y verificar que el dashboard solo muestra datos de ese hotel (RLS). El gerente **no puede crear** KPIs nuevos ni inactivarlos.

## Aclaraciones por HU

| HU | Permiso | Notas |
|----|---------|-------|
| HU-001 | `kpis.crear`, `kpis.editar`, `kpis.inactivar` | Gerente solo `kpis.editar` en KPIs de su hotel |
| HU-002 | `metas.configurar` | Mismos roles que editar KPI |
| HU-003 | `kpis.editar` | Fórmulas y variables |
| HU-004 | `import.cargar` | Todos excepto consulta |
| HU-005 | `integraciones.gestionar` | admin, director_comercial, analista |
| HU-006/007 | `dashboard.ver` | Todos |
| HU-010 | `reportes.exportar` | Todos (incl. consulta) |
| HU-011 | `usuarios.gestionar` | Solo administrador asigna roles/scopes |
| HU-012 | `auditoria.ver` | Bitácora en Seguridad (admin + analista) |

## Checklist de verificación manual

Crear 6 usuarios (o cambiar rol desde administrador) y validar:

### administrador
- [ ] Ve todos los ítems del sidebar incl. Seguridad y Catálogo
- [ ] Puede crear, editar e inactivar KPIs
- [ ] Puede asignar roles y alcances en `/seguridad`
- [ ] Ve datos de todos los hoteles en dashboard

### director_comercial
- [ ] No ve Seguridad ni Catálogo
- [ ] Puede crear/editar KPIs e importar
- [ ] Ve y gestiona integraciones
- [ ] `/integraciones` accesible; `/seguridad` redirige a dashboard

### director_mercadeo
- [ ] Igual que director_comercial **excepto** integraciones
- [ ] No ve ítem Integraciones en sidebar
- [ ] `/integraciones` redirige a dashboard

### gerente_hotel
- [ ] Con `user_hotel_scopes` asignado: dashboard filtrado a su hotel
- [ ] Puede editar KPIs de su hotel (no crear ni inactivar)
- [ ] Puede importar y configurar metas
- [ ] No accede a integraciones ni seguridad

### analista
- [ ] Ve Seguridad y Catálogo en **modo lectura** (sin selectores de rol)
- [ ] Puede gestionar integraciones
- [ ] Puede crear/editar KPIs según scopes asignados

### consulta
- [ ] Solo dashboard, alertas, reportes y perfil
- [ ] Puede exportar reportes; no importar ni editar KPIs
- [ ] Botones de edición ocultos en toda la UI

## Checklist HU-006 / HU-007 (Sprint 0)

- [ ] Dashboard: tarjetas KPI con semáforo
- [ ] Filtros región / hotel / período
- [ ] Gráfico tendencias + comparativo mes/año
- [ ] Línea de proyección etiquetada como estimación
- [ ] Top indicadores críticos
- [ ] Drill-down con mini gráfico

## Migración

Aplicar `supabase/migrations/20250619000001_rbac_matrix_fix.sql` para sincronizar `role_permissions` y RLS de `kpis_update` para gerente_hotel.
