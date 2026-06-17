# Roles del sistema y cumplimiento vs. requerimientos

Documento de referencia que contrasta los **roles implementados** en Hoteles Estelar KPI con las **Historias de Usuario** del PDF de requerimientos (*Historias de Usuario — Sistema de KPIs para Mercadeo y Ventas*).

**Fuentes:**

| Fuente | Ubicación |
|--------|-----------|
| Requerimientos (PDF) | `Historias de Usuario - Sistema de KPIs.pdf` (Semillero Venesoft) |
| Matriz operativa | [`docs/test-matrix-roles.md`](./test-matrix-roles.md) |
| Código (permisos) | [`lib/auth/role-matrix.ts`](../lib/auth/role-matrix.ts) |
| Base de datos (RLS) | `supabase/migrations/20250614000002_auth_rbac_rls.sql`, `20250622000001_rbac_roles_realignment.sql` |

**Leyenda de cumplimiento**

| Símbolo | Significado |
|---------|-------------|
| ✅ | **Cumple** — el rol puede ejecutar lo esperado según PDF + matriz |
| ⚠️ | **Parcial** — funciona en lo esencial, con límites técnicos o de alcance |
| ❌ | **No cumple** — ausente o bloqueado de forma incorrecta |

---

## 1. Roles existentes en el sistema

El enum `app_role` define **seis roles** (HU-KPI-011):

| Rol (`app_role`) | Etiqueta UI | Descripción breve |
|------------------|-------------|-------------------|
| `administrador` | Administrador | Control total: KPIs, usuarios, alcances, catálogo, integraciones |
| `director_comercial` | Director comercial | Visión ejecutiva: dashboard, KPIs lectura, reportes, catálogo lectura |
| `director_mercadeo` | Director de mercadeo | Igual que director comercial |
| `gerente_hotel` | Gerente de hotel | Operación en hotel asignado: metas, valores, import, alertas, planes |
| `analista` | Analista | Rol operativo global: import e integraciones; sin seguridad ni planes |
| `consulta` | Consulta | Solo lectura: dashboard, KPIs, exportación de reportes |

**Alcance geográfico:** configurable en `/seguridad` con selección **múltiple** (checkboxes + Confirmar alcance). Solo **administrador**; no puede editar su propio alcance.

**Permisos técnicos** (tabla `permissions` + `role_permissions`):

`kpis.crear` · `kpis.editar` · `kpis.inactivar` · `kpis.ver` · `metas.configurar` · `dashboard.ver` · `import.cargar` · `integraciones.gestionar` · `reportes.exportar` · `catalogo.ver` · `catalogo.gestionar` · `alertas.ver` · `planes.gestionar` · `usuarios.gestionar` · `auditoria.ver`

---

## 2. Resumen ejecutivo por rol

| Rol | Cumplimiento global | Comentario |
|-----|---------------------|------------|
| **administrador** | ✅ Cumple | Superusuario operativo y de seguridad |
| **director_comercial** | ✅ Cumple | Lectura ejecutiva + catálogo; sin operación táctica |
| **director_mercadeo** | ✅ Cumple | Igual que comercial |
| **gerente_hotel** | ✅ Cumple | Metas/valores/planes en alcance; sin editar definición KPI |
| **analista** | ✅ Cumple | Import + integraciones; sin seguridad/catálogo/planes |
| **consulta** | ✅ Cumple | Lectura y exportación |

---

## 3. Matriz rol × historia de usuario

### FEATURE 1 — Administración de KPIs

| HU | Requerimiento (PDF) | administrador | director_* | gerente_hotel | analista | consulta |
|----|---------------------|:-------------:|:----------:|:-------------:|:--------:|:--------:|
| **HU-KPI-001** Crear/editar/duplicar/inactivar KPI | Administrador | ✅ | ❌ lectura | ❌ lectura | ❌ lectura | ❌ lectura |
| **HU-KPI-002** Metas y semáforo | Administrador + operación hotel | ✅ | ❌ | ✅ en alcance | ❌ | ❌ |
| **HU-KPI-003** Fórmulas y variables | Administrador | ✅ crear/editar | 👁️ lectura fórmula | 👁️ | 👁️ | 👁️ |

**HU-KPI-003 (Fase 1):** variables simples/compuestas, fórmulas por KPI, cálculo con inputs por variable (registro + import `var_*`). **Fase 2 pendiente:** `kpi("CODIGO")` para indicadores derivados.

### FEATURE 2 — Carga e integración

| HU | Requerimiento (PDF) | administrador | director_* | gerente_hotel | analista | consulta |
|----|---------------------|:-------------:|:----------:|:-------------:|:--------:|:--------:|
| **HU-KPI-004** Import Excel/CSV | Operación | ✅ | ❌ | ✅ | ✅ | ❌ |
| **HU-KPI-005** Integraciones externas | Técnico | ✅ | ❌ | ❌ | ✅ | ❌ |

### FEATURE 3 — Dashboards y analítica

| HU | Requerimiento (PDF) | Roles con `dashboard.ver` + `kpis.ver` |
|----|---------------------|----------------------------------------|
| **HU-KPI-006** Dashboard ejecutivo | Director comercial | ✅ Todos los roles listados |
| **HU-KPI-007** Tendencias históricas | Usuario genérico | ✅ |

### FEATURE 4 — Alertas y seguimiento

| HU | Requerimiento (PDF) | administrador | director_* | gerente_hotel | analista | consulta |
|----|---------------------|:-------------:|:----------:|:-------------:|:--------:|:--------:|
| **HU-KPI-008** Alertas automáticas | Sistema | ✅ | ❌ oculto | ✅ según alcance | ❌ | ❌ |
| **HU-KPI-009** Planes de acción | Líder operativo | ✅ | ❌ | ✅ | ❌ | ❌ |

Directores **no ven** el módulo Alertas (decisión de producto confirmada).

### FEATURE 5 — Reportes

| HU | Requerimiento (PDF) | Roles con `reportes.exportar` |
|----|---------------------|-------------------------------|
| **HU-KPI-010** Export PDF/Excel/PPT | Usuario genérico | ✅ Todos excepto roles sin permiso |

### FEATURE 6 — Seguridad y auditoría

| HU | Requerimiento (PDF) | administrador | Resto |
|----|---------------------|:-------------:|:-----:|
| **HU-KPI-011** Roles, permisos, alcance | Administrador | ✅ gestión completa + multi-select | ❌ sin acceso UI |
| **HU-KPI-012** Auditoría / bitácora | Sistema | ✅ | ❌ |

---

## 4. Detalle por rol

### 4.1 administrador

| Área | Estado | Detalle |
|------|--------|---------|
| Sidebar | ✅ | Todos los módulos |
| KPIs | ✅ | Crear, editar, duplicar, inactivar, fórmulas |
| Seguridad | ✅ | Roles, alcance multi-hotel/región (no propio) |
| Catálogo | ✅ | Crear regiones/hoteles |

### 4.2 director_comercial / director_mercadeo

| Área | Estado | Detalle |
|------|--------|---------|
| Sidebar | ✅ | Dashboard, KPIs, Reportes, Catálogo, Perfil |
| KPIs | ✅ lectura | Sin crear/editar/duplicar/inactivar |
| Catálogo | ✅ lectura | Sin `catalogo.gestionar` |
| Import / integraciones / alertas | ❌ | Ocultos y bloqueados por permiso |
| Reportes | ✅ | Exportación |

### 4.3 gerente_hotel

| Área | Estado | Detalle |
|------|--------|---------|
| Alcance | ⚠️ | Requiere scopes asignados en Seguridad |
| KPIs | ✅ lectura + metas | Valores y metas OK; sin editar definición/fórmulas |
| Import / alertas / planes | ✅ | En su ámbito |
| Integraciones / catálogo / seguridad | ❌ | |

### 4.4 analista

| Área | Estado | Detalle |
|------|--------|---------|
| KPIs | ✅ lectura | Sin edición de definición |
| Import / integraciones | ✅ | Rol operativo global |
| Seguridad / catálogo / alertas / planes | ❌ | |

### 4.5 consulta

| Área | Estado | Detalle |
|------|--------|---------|
| Dashboard / KPIs | ✅ lectura | |
| Reportes export | ✅ | |
| Resto de módulos | ❌ | |

---

## 5. Tabla de permisos (referencia rápida)

Extraída de [`lib/auth/role-matrix.ts`](../lib/auth/role-matrix.ts):

| Permiso | admin | dir. comercial | dir. mercadeo | gerente_hotel | analista | consulta |
|---------|:-----:|:--------------:|:-------------:|:-------------:|:--------:|:--------:|
| `kpis.ver` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `kpis.crear` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `kpis.editar` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `kpis.inactivar` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `metas.configurar` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `dashboard.ver` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `import.cargar` | ✅ | ❌ | ❌ | ✅ | ✅ | ❌ |
| `integraciones.gestionar` | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `reportes.exportar` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `catalogo.ver` | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| `catalogo.gestionar` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `alertas.ver` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `planes.gestionar` | ✅ | ❌ | ❌ | ✅ | ❌ | ❌ |
| `usuarios.gestionar` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `auditoria.ver` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

---

## 6. Brechas transversales (producto)

| # | Brecha | HUs | Impacto |
|---|--------|-----|---------|
| 1 | Metas por periodo no enlazan automáticamente al registrar valor | HU-002 | Cumplimiento simplificado |
| 2 | Variables de fórmula con un solo valor de entrada | HU-003 | Cálculo simplificado |
| 3 | Sin notificaciones push nativas | HU-008 | Activepieces / módulo alertas |
| 4 | Rol "Líder comercial" no modelado | HU-009 | Cubierto por gerente |

**Migración RBAC:** `supabase db push` → `20250622000001_rbac_roles_realignment.sql`

---

## 7. Conclusión

Tras la realineación RBAC, cada rol coincide con las reglas operativas acordadas: directores en lectura ejecutiva, gerente operativo sin edición de definición KPI, analista import/integraciones sin seguridad, consulta solo lectura.

Para verificación manual, usar [`docs/test-matrix-roles.md`](./test-matrix-roles.md).

---

*Última revisión: realineación RBAC (`kpis.ver`, `catalogo.ver`, `alertas.ver`, `planes.gestionar`), sidebar por permiso, ScopeSelectorPanel multi-alcance.*
