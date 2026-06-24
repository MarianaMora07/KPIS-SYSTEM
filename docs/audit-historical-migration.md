# Migración histórica de audit_logs (estelar-kpi → kpis-system)

Este documento describe cómo migrar datos históricos de `audit_logs` del Supabase origen (`estelar-kpi`) al esquema destino (`kpis-system`). **Ejecutar solo cuando haya acceso al proyecto origen y se confirme la necesidad de conservar historial.**

## Mapeo de esquema

| Origen (estelar-kpi) | Destino (kpis-system) |
|----------------------|------------------------|
| `user_id` | `usuario_id` |
| — | `usuario_email` (JOIN `user_profiles`) |
| `table_name` | `entidad` |
| `record_id` | `entidad_id` |
| `action` (varchar) | `accion` (`audit_action` enum) |
| `old_value` | `valor_anterior` |
| `new_value` | `valor_nuevo` |
| `created_at` | `fecha`, `hora`, `created_at` |

## Mapeo de acciones

| Origen `action` | Destino `accion` | Notas |
|-----------------|------------------|-------|
| `INSERT` | `crear` | |
| `UPDATE` | `actualizar` | |
| `DELETE` | `eliminar` | |
| `UPDATE_VERSION` | `actualizar` | Añadir `"tipo_version": true` en `valor_nuevo` si se necesita filtrar |

## Mapeo de entidades

| Origen `table_name` | Destino `entidad` |
|---------------------|-------------------|
| `kpis` | `kpis` |
| `action_plans` | `action_plans` |
| `kpi_measurements` | `kpi_values` |
| `kpi_targets` | `kpi_targets` |
| `user_roles` | `user_roles` |

## Mapeo estados plan de acción (solo lectura / timeline)

| Origen `status` | Destino `estado` |
|-----------------|------------------|
| `PENDIENTE` | `abierto` |
| `EN_PROGRESO` | `en_progreso` |
| `COMPLETADO` | `completado` |

## Script SQL de migración

Ejecutar en el destino conectando al origen vía `dblink`, export CSV, o tabla staging intermedia `origen_audit_logs`:

```sql
INSERT INTO audit_logs (
  usuario_id,
  usuario_email,
  fecha,
  hora,
  accion,
  entidad,
  entidad_id,
  valor_anterior,
  valor_nuevo,
  created_at
)
SELECT
  o.user_id,
  up.email,
  o.created_at::date,
  o.created_at::time,
  CASE o.action
    WHEN 'INSERT' THEN 'crear'::audit_action
    WHEN 'UPDATE' THEN 'actualizar'::audit_action
    WHEN 'DELETE' THEN 'eliminar'::audit_action
    WHEN 'UPDATE_VERSION' THEN 'actualizar'::audit_action
  END,
  CASE o.table_name
    WHEN 'kpi_measurements' THEN 'kpi_values'
    ELSE o.table_name
  END,
  o.record_id,
  o.old_value,
  CASE
    WHEN o.action = 'UPDATE_VERSION' THEN
      COALESCE(o.new_value, '{}'::jsonb) || '{"tipo_version": true}'::jsonb
    ELSE o.new_value
  END,
  o.created_at
FROM origen_audit_logs o
LEFT JOIN user_profiles up ON up.id = o.user_id
WHERE o.action IN ('INSERT', 'UPDATE', 'DELETE', 'UPDATE_VERSION');
```

## Equivalencias sin migrar a audit_logs

| Concepto origen | Equivalente destino |
|-----------------|---------------------|
| `integration_logs` (plano) | `integration_jobs` + `integration_logs` (jerárquico) |
| `kpi_measurements.imported_by` | `import_jobs.usuario_id` + `kpi_values.fuente` |
| `UPDATE_VERSION` explícito | Trigger `actualizar` en `kpis` + `kpi_versions` con `_audit_subtype: version_bump` |

## Checklist post-migración

- [ ] Conteo de filas origen vs destino (± filas con `action` desconocida)
- [ ] Muestra aleatoria: diff UI en `/auditoria` muestra `valor_anterior` / `valor_nuevo`
- [ ] `usuario_email` poblado donde existía `user_id` en origen
- [ ] Timeline de planes filtra `valor_nuevo.estado` correctamente
- [ ] No se intentó UPDATE/DELETE en `audit_logs` (inmutabilidad)
- [ ] RLS: solo roles autorizados ven registros migrados

## Notas

- La escritura en destino es **solo vía triggers** (`Insert: never` en tipos). No replicar inserts manuales de `UPDATE_VERSION` del origen.
- Ejecutar migración en ventana de mantenimiento; `audit_logs` es inmutable — corregir errores requiere nueva fila o rollback de lote insertado.
