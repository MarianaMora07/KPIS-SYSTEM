# Matriz de prueba por rol (HU-KPI-011)

Fuente operativa alineada con el PDF de requerimientos y [`lib/auth/role-matrix.ts`](../lib/auth/role-matrix.ts).

Usuarios de prueba: registrarse en `/login` y asignar rol desde `/seguridad` (solo **administrador** puede asignar roles y alcances).

## Sidebar por rol

| Rol | Ítems visibles en sidebar |
|-----|---------------------------|
| **administrador** | Dashboard, KPIs, Importar, Integraciones, Alertas, Reportes, Catálogo, Seguridad, Perfil |
| **director_comercial** | Dashboard, KPIs, Reportes, Catálogo, Perfil |
| **director_mercadeo** | Igual que director comercial |
| **gerente_hotel** | Dashboard, KPIs, Importar, Alertas, Reportes, Perfil |
| **analista** | Dashboard, KPIs, Importar, Integraciones, Reportes, Perfil |
| **consulta** | Dashboard, KPIs, Reportes, Perfil |

## Matriz de permisos

| Permiso | admin | dir. comercial | dir. mercadeo | gerente_hotel | analista | consulta |
|---------|:-----:|:--------------:|:-------------:|:-------------:|:--------:|:--------:|
| `dashboard.ver` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `kpis.ver` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `kpis.crear` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `kpis.editar` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `kpis.inactivar` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `metas.configurar` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `import.cargar` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `integraciones.gestionar` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `reportes.exportar` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `catalogo.ver` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `catalogo.gestionar` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `alertas.ver` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `planes.gestionar` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `usuarios.gestionar` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `auditoria.ver` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Notas:**

- Directores ven KPIs en **solo lectura** (sin crear/editar/duplicar/inactivar, sin fórmulas/variables editables).
- Gerente puede **metas, valores y planes** en su alcance; **no** edita definición de KPI ni fórmulas.
- Analista es rol operativo global (import + integraciones); **sin** seguridad, catálogo, alertas ni planes.
- Consulta: dashboard, KPIs lectura, exportación.

## Alcance geográfico

Configurable en `/seguridad` con **checkboxes multi-selección** + botón **Confirmar alcance** (solo administrador, no sobre sí mismo).

| Rol | Scope esperado |
|-----|----------------|
| administrador | Todos los hoteles |
| director_comercial / director_mercadeo | Todos (`fn_user_has_full_access`) |
| gerente_hotel | Solo hoteles/regiones asignados (RLS) |
| analista | Global operativo (`fn_user_has_full_access`) |
| consulta | Según scopes; lectura |

## Checklist de verificación manual

### administrador
- [ ] Ve todos los ítems del sidebar incl. Seguridad y Catálogo
- [ ] Puede crear, editar e inactivar KPIs
- [ ] Puede asignar roles y alcance **multi-hotel/región** en `/seguridad`
- [ ] No puede editar su propio alcance
- [ ] Ve datos de todos los hoteles en dashboard

### director_comercial
- [ ] Sidebar: Dashboard, KPIs, Reportes, Catálogo, Perfil (5 ítems + perfil)
- [ ] KPI detalle **sin** botones crear/editar/duplicar/inactivar
- [ ] Catálogo en lectura (sin "Nueva región/hotel")
- [ ] `/import`, `/integraciones`, `/alertas`, `/seguridad` redirigen o no aparecen en sidebar

### director_mercadeo
- [ ] Igual que director_comercial

### gerente_hotel
- [ ] Con `user_hotel_scopes` asignado: dashboard filtrado a su hotel
- [ ] Puede registrar valores y configurar metas; **no** editar definición KPI ni fórmulas
- [ ] Puede importar, ver alertas y gestionar planes de acción
- [ ] No accede a integraciones, catálogo ni seguridad

### analista
- [ ] Sidebar: Dashboard, KPIs, Importar, Integraciones, Reportes, Perfil
- [ ] KPIs en lectura (sin edición de definición)
- [ ] Puede importar y ver logs de integraciones
- [ ] **No** ve Seguridad, Catálogo, Alertas ni tab Planes
- [ ] Sin botones resolver/escalar alertas ni plan de acción

### consulta
- [ ] Sidebar: Dashboard, KPIs, Reportes, Perfil
- [ ] KPIs y dashboard en lectura; puede exportar reportes
- [ ] Sin import, integraciones, alertas, metas ni edición

## Checklist HU-006 / HU-007

- [ ] Dashboard: tarjetas KPI con semáforo
- [ ] Filtros región / hotel / período
- [ ] Gráfico tendencias + comparativo mes/año
- [ ] Línea de proyección etiquetada como estimación
- [ ] Top indicadores críticos (link alerta/plan según permiso)
- [ ] Drill-down con mini gráfico

## Migración

Aplicar migraciones con `supabase db push`:

- `20250622000001_rbac_roles_realignment.sql` — permisos granulares + matriz `role_permissions` + RLS KPIs/planes
