# Integración de datos vía SQL estructurado

## Idea central

Los KPIs pueden cargar datos desde una base de datos mediante **SQL armado por cláusulas** (SELECT, FROM, WHERE, GROUP BY, HAVING, ORDER BY). Cada cláusula es un campo independiente en la UI; las que quedan vacías **no se incluyen** en el SQL final.

El resultado de la consulta alimenta las **variables de la fórmula** del indicador. El motor existente (`computeKpiValueFromInputs`) calcula `valor_real` igual que en registro manual, importación Excel o integraciones HTTP.

```
Conexión DB → Cláusulas SQL por KPI → Ejecución read-only → Mapeo a variables → Fórmula → kpi_values
```

## Arquitectura

```mermaid
flowchart TB
  subgraph config [Configuración]
    Conn[database_connections]
    SqlSrc[kpi_sql_sources]
    Integ[external_integrations tipo sql_database]
  end
  subgraph ui [UI]
    Integraciones[Integraciones → Conexiones]
    KpiPanel[Detalle KPI → Fuente SQL]
    LoadBtn[Cargar desde BD]
  end
  subgraph server [Servidor]
    Build[buildStructuredSql]
    Validate[validateReadOnlySql]
    Exec[executeReadOnlyQuery pg]
    Map[mapQueryRowsToKpiRecords]
    Formula[computeKpiValueFromInputs]
  end
  subgraph data [Datos]
    Values[(kpi_values)]
  end
  Integraciones --> Conn
  KpiPanel --> SqlSrc
  SqlSrc --> Conn
  Integ --> Conn
  KpiPanel --> Build --> Validate --> Exec --> Map --> Formula --> Values
  LoadBtn --> Build
  Integ -->|sync cron/manual| Build
```

### Tablas y módulos

| Pieza | Tabla / archivo | Qué guarda |
|-------|-------------------|------------|
| Conexiones | `database_connections` | Supabase interno o PostgreSQL externo |
| Fuente SQL por KPI | `kpi_sql_sources` | Cláusulas SQL (relación 1:1 con `kpis`) |
| Integración programada | `external_integrations` (`sistema_tipo = sql_database`) | Sync automático apuntando a una conexión |
| Ensamblado SQL | `lib/sql/build-structured-query.ts` | Construye el SELECT omitiendo cláusulas vacías |
| Validación | `lib/sql/validate-readonly-sql.ts` | Solo permite consultas SELECT |
| Ejecución | `lib/sql/execute-query.ts` | Cliente `pg`, timeout y LIMIT |
| Mapeo | `lib/sql/map-query-rows.ts` | Filas → `ExternalKpiRecord` |
| UI conexiones | `modules/sql-data-sources/components/database-connections-panel.tsx` | CRUD en Integraciones |
| UI constructor | `modules/sql-data-sources/components/structured-sql-builder.tsx` | Campos por cláusula |
| UI KPI | `modules/sql-data-sources/components/kpi-sql-source-panel.tsx` | Tarjeta + modal wizard en detalle del KPI |
| Carga manual | `modules/sql-data-sources/components/kpi-sql-load-button.tsx` | Confirmación con preview antes de importar |
| Adapter sync | `modules/integraciones/adapters/sql-database-adapter.ts` | Ejecuta todas las fuentes de una conexión |

Migración: `supabase/migrations/20260625000001_sql_data_sources.sql`

---

## 1. Configurar la conexión

Ruta: **Integraciones → Conexiones de base de datos**

| Tipo | Descripción |
|------|-------------|
| `supabase_internal` | Usa `DATABASE_URL` del servidor (proyecto actual). Sin credenciales en UI. |
| `postgres_external` | Host, puerto, base, usuario y contraseña (cifrada en reposo). |

Acciones disponibles:

- **Crear** conexión
- **Probar** (`POST /api/database-connections/[id]/test` → `SELECT 1`)
- **Eliminar** conexión

Se inserta por defecto la conexión **«Supabase (proyecto)»** al aplicar la migración.

### Obtener `DATABASE_URL` (Supabase interno)

1. En el dashboard de Supabase, abra su proyecto.
2. Clic en **Connect** (barra superior del proyecto).
3. Pestaña **Direct** → elija **Session pooler** (puerto `5432`) si está en Windows o red sin IPv6.
4. Copie la URI `postgresql://...` y reemplace `[YOUR-PASSWORD]` por la contraseña de la base de datos.
5. En `.env.local`:

```env
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

6. Reinicie el servidor Next.js (`npm run dev`).

> **Nota:** La URL `db.[ref].supabase.co` (Direct connection) suele ser solo IPv6. Si obtiene `ENOTFOUND`, use el **Session pooler** con host `*.pooler.supabase.com`.

---

## Guía de prueba paso a paso (Conversión web)

Esta guía recorre el módulo completo: desde crear datos en PostgreSQL hasta ver valores guardados en el KPI **Conversión web (CNV-001)** del seed.

### Requisitos previos

| Requisito | Cómo verificar |
|-----------|----------------|
| Migraciones aplicadas | `supabase/migrations/20260625000001_sql_data_sources.sql` ejecutada |
| `DATABASE_URL` en `.env.local` | Ver sección anterior |
| App en marcha | `npm run dev` |
| Usuario con permisos | `integraciones.gestionar`, `kpis.editar`, `metas.configurar` |
| KPI de prueba | **Conversión web** (`CNV-001`) en `/kpis` |

---

### Paso 0 — Crear tabla de ejemplo en Supabase

En **Supabase → SQL Editor**, ejecute:

```sql
CREATE TABLE IF NOT EXISTS web_conversion_mensual (
  periodo        DATE NOT NULL,
  hotel_codigo   VARCHAR(10) NOT NULL,
  visitas_mes    INTEGER NOT NULL,
  reservas_web   INTEGER NOT NULL,
  PRIMARY KEY (periodo, hotel_codigo)
);

INSERT INTO web_conversion_mensual (periodo, hotel_codigo, visitas_mes, reservas_web) VALUES
  ('2026-01-01', 'CTG', 12000, 264),
  ('2026-02-01', 'CTG', 11500, 253),
  ('2026-03-01', 'CTG', 13000, 299),
  ('2026-04-01', 'CTG', 12800, 307),
  ('2026-05-01', 'CTG', 14000, 315),
  ('2026-06-01', 'CTG', 13500, 284)
ON CONFLICT (periodo, hotel_codigo) DO NOTHING;
```

Compruebe que hay filas:

```sql
SELECT * FROM web_conversion_mensual ORDER BY periodo DESC;
```

`CTG` corresponde a **Estelar Cartagena**, hotel del KPI Conversión web en el seed.

---

### Paso 1 — Probar la conexión

1. Vaya a **Integraciones → Conexiones de base de datos**.
2. Localice **Supabase (proyecto)** (creada por la migración).
3. Clic en **Probar conexión**.
4. Debe aparecer **Conexión exitosa** (el servidor ejecuta `SELECT 1` vía `pg`).

Si falla:

| Error | Solución |
|-------|----------|
| `DATABASE_URL no configurada` | Añadir variable en `.env.local` y reiniciar |
| `ENOTFOUND db.*.supabase.co` | Usar Session pooler en lugar de Direct |
| `password authentication failed` | Resetear contraseña en Supabase → Connect |

---

### Paso 2 — Configurar la fórmula del KPI

1. Abra **KPIs → Conversión web (CNV-001) → pestaña Seguimiento**.
2. En el bloque **Fórmula del indicador**, si no hay fórmula activa:
   - Cree variables globales en **KPIs → Variables**: `visitas_mes`, `reservas_web`.
   - Fórmula: `reservas_web / visitas_mes * 100`
   - **Validar y guardar**.
3. Si ya hay fórmula, verá la **tarjeta verde «Fórmula activa»** con la expresión y versión.

> Los valores importados desde SQL usan esta fórmula para calcular `valor_real`. Ejemplo junio: `284 / 13500 * 100 ≈ 2,10%`.

---

### Paso 3 — Configurar la fuente SQL (wizard de 4 pasos)

1. En la misma página, clic en la tarjeta **«Carga tu indicador desde base de datos»**.
2. Siga el wizard:

#### Paso 1 — Conexión

| Campo | Valor |
|-------|-------|
| Conexión | **Supabase (proyecto)** |

#### Paso 2 — Consulta SQL

| Campo | Valor |
|-------|-------|
| SELECT | `visitas_mes, reservas_web, periodo` |
| FROM | `web_conversion_mensual` |
| WHERE | `hotel_codigo = 'CTG'` |
| ORDER BY | `periodo DESC` |

SQL ensamblado en servidor:

```sql
SELECT visitas_mes, reservas_web, periodo
FROM web_conversion_mensual
WHERE hotel_codigo = 'CTG'
ORDER BY periodo DESC
LIMIT 1000
```

#### Paso 3 — Mapeo

| Campo | Valor |
|-------|-------|
| Columna fecha | `periodo` |
| Columna hotel | `hotel_codigo` |

#### Paso 4 — Ejecutar

1. **Guardar fuente SQL** → la tarjeta pasa a estado **Activa**.
2. **Probar consulta** → debe mostrar 6 filas en la tabla de preview (sin guardar en `kpi_values`).

---

### Paso 4 — Importar valores al KPI

En la **barra superior** del detalle del KPI:

| Acción | Qué hace |
|--------|----------|
| **Cargar desde BD** | Muestra modal de confirmación con fecha, variables y valor calculado de la **fila más reciente** (según ORDER BY). Al confirmar, guarda **una fila** en `kpi_values` con `fuente = 'sql'`. |
| **Importar todas las filas** | Modal con rango de fechas y cantidad. Al confirmar, upsert de hasta 1000 filas. |

Tras importar:

1. El gráfico y la tabla de **Seguimiento** muestran los nuevos valores.
2. Cada registro guarda `variable_inputs` (snapshot de `visitas_mes`, `reservas_web`) y `valor_real` calculado.
3. El toast confirma la fecha importada (ej. *«Valor del 2026-06-01 importado correctamente»*).

Verifique en la app o en Supabase:

```sql
SELECT fecha, valor_real, variable_inputs, fuente
FROM kpi_values
WHERE kpi_id = 'd4000000-0000-4000-8000-000000000003'
ORDER BY fecha DESC;
```

---

### Paso 5 — (Opcional) Pre-llenar formulario manual

En **Registrar valor**, el botón **Cargar desde BD** (dentro del modal) ejecuta la consulta y pre-llena fecha y variables **sin guardar** hasta que el usuario confirme el registro.

---

### Paso 6 — (Opcional) Sync automático

1. **Integraciones → Nueva integración → Base de datos SQL**.
2. Seleccione la conexión Supabase.
3. Configure cron si aplica (`POST /api/integraciones/cron` con `CRON_SECRET`).
4. Al sincronizar, `SqlDatabaseAdapter` ejecuta todas las fuentes SQL ligadas a esa conexión y guarda con `fuente = 'integracion'`.

---

### Checklist de verificación

- [ ] `DATABASE_URL` configurada y conexión probada OK en Integraciones
- [ ] Tabla `web_conversion_mensual` con datos en Supabase
- [ ] Fórmula activa en CNV-001 (`reservas_web / visitas_mes * 100`)
- [ ] Fuente SQL guardada y **Probar consulta** devuelve filas
- [ ] **Cargar desde BD** muestra preview (fecha, variables, valor) antes de confirmar
- [ ] Valores visibles en seguimiento con `fuente = sql`
- [ ] `variable_inputs` JSONB contiene las variables de la fila importada

---

## 2. Configurar el KPI con SQL estructurado

Ruta: **Detalle del KPI → tarjeta «Carga tu indicador desde base de datos»** (modal wizard)

| Campo UI | Obligatorio | Ejemplo (CNV-001) |
|----------|-------------|-------------------|
| Conexión | Sí | Supabase (proyecto) |
| SELECT | Sí | `visitas_mes, reservas_web, periodo` |
| FROM | Sí | `web_conversion_mensual` |
| WHERE | No | `hotel_codigo = 'CTG'` |
| GROUP BY | No | — |
| HAVING | No | — |
| ORDER BY | No | `periodo DESC` |
| DISTINCT | No | toggle Y/N |
| Columna fecha | Sí (default `fecha`) | `periodo` |
| Columna hotel | No | `hotel_codigo` |

### SQL ensamblado

Con los valores de Conversión web:

```sql
SELECT visitas_mes, reservas_web, periodo
FROM web_conversion_mensual
WHERE hotel_codigo = 'CTG'
ORDER BY periodo DESC
```

En servidor siempre se añade `LIMIT 1000` (no editable por el usuario).

### Probar consulta

En el **paso 4** del wizard: ejecuta el SQL y muestra las primeras filas **sin persistir** en `kpi_values` (`POST /api/kpis/[id]/sql-source/preview`).

### Quitar fuente SQL

Botón **Quitar fuente SQL** en el paso 4 → modal de confirmación del sistema. Elimina la configuración en `kpi_sql_sources`; los valores ya importados en `kpi_values` **no se borran**.

---

## 3. Mapeo fila → variables del KPI

Por cada fila del resultado:

| Columna / regla | Destino |
|-----------------|---------|
| `fecha_column` (default `fecha`) | `kpi_values.fecha` |
| Columnas numéricas alineadas con la fórmula | `variable_inputs` (JSONB) |
| `variable_column_map` (opcional) | Mapea alias SQL → código de variable, ej. `{"ventas_mes": "ventas"}` |
| `hotel_column` (opcional) | Lookup en `hotels.codigo` → `hotel_id` |
| Sin variables en fórmula | Primera columna numérica → valor escalar |

Luego `computeKpiValueFromInputs` (ver [kpi-formula-architecture.md](./kpi-formula-architecture.md)) produce `valor_real`.

---

## 4. Formas de cargar datos

### A) Manual (desde el KPI)

| Acción | Comportamiento | `fuente` en `kpi_values` |
|--------|----------------|--------------------------|
| **Cargar desde BD** (formulario «Registrar valor») | Ejecuta la consulta, toma la **primera fila** y pre-llena fecha y variables | No guarda; el usuario confirma |
| **Cargar desde BD** (toolbar del KPI) | Modal de confirmación con preview (fecha, variables, valor calculado) → guarda **una fila** | `sql` |
| **Importar todas las filas** | Modal con resumen de filas/fechas → upsert de hasta 1000 filas | `sql` |

API: `POST /api/kpis/[id]/sql-source/load` con `{ "mode": "single" | "all" }`.

Flujo recomendado en toolbar:

```
Clic «Cargar desde BD» → preview API → modal confirmación → load API → refresh → valores en seguimiento
```

### B) Automática (integración programada)

1. Crear integración tipo **Base de datos SQL** en Integraciones.
2. Seleccionar la conexión (`auth_config.connection_id`).
3. Opcional: `frecuencia_cron` + disparador `POST /api/integraciones/cron`.

Al sincronizar, `SqlDatabaseAdapter`:

1. Lee `connection_id` de la integración.
2. Lista todos los `kpi_sql_sources` de esa conexión.
3. Por cada KPI: ensambla SQL → valida → ejecuta → mapea filas.
4. El processor de integraciones calcula la fórmula y hace upsert con `fuente: integracion` e `integration_id`.

---

## 5. Ejemplo alternativo (margen de ventas)

Si prefiere otro KPI sin depender del seed CNV-001:

```sql
CREATE TABLE ventas_mensuales (
  fecha  DATE NOT NULL PRIMARY KEY,
  ventas NUMERIC NOT NULL,
  costos NUMERIC NOT NULL
);

INSERT INTO ventas_mensuales (fecha, ventas, costos) VALUES
  ('2026-01-31', 120000, 80000),
  ('2026-02-28', 135000, 85000);
```

1. Variables globales: `ventas`, `costos`.
2. Fórmula del KPI: `ventas / costos * 100` (o la que necesite).
3. Fuente SQL: SELECT `ventas, costos, fecha` FROM `ventas_mensuales`, ORDER BY `fecha DESC`, columna fecha `fecha`.
4. Probar consulta → Cargar desde BD.

> La tabla `ventas_mensuales` **no existe por defecto**; debe crearla en SQL Editor antes de usarla en FROM.

---

## 6. APIs

| Ruta | Método | Permiso | Propósito |
|------|--------|---------|-----------|
| `/api/database-connections` | GET, POST | `integraciones.gestionar` / `kpis.editar` (lectura) | Listar y crear conexiones |
| `/api/database-connections/[id]` | GET, PATCH, DELETE | `integraciones.gestionar` | CRUD conexión |
| `/api/database-connections/[id]/test` | POST | `integraciones.gestionar` | Probar conexión |
| `/api/kpis/[id]/sql-source` | GET, PUT, DELETE | `kpis.editar` | Leer/guardar/eliminar fuente SQL |
| `/api/kpis/[id]/sql-source/preview` | POST | `kpis.editar` | Ejecutar sin guardar |
| `/api/kpis/[id]/sql-source/load` | POST | `metas.configurar` | Cargar e importar valores |

---

## 7. Seguridad y límites

- La ejecución SQL es **solo server-side** (nunca desde el cliente Supabase anon).
- Validación estricta: solo `SELECT`, sin `;`, sin DDL/DML (`INSERT`, `UPDATE`, `DELETE`, `DROP`, etc.).
- `LIMIT 1000` forzado en servidor.
- Timeout de consulta ~10 s.
- Contraseñas externas cifradas con `DB_CONNECTION_SECRET` o `AI_MASTER_SECRET`.
- Recomendación: usuario PostgreSQL externo con permisos **solo SELECT**.

---

## 8. Variables de entorno

| Variable | Uso |
|----------|-----|
| `DATABASE_URL` | Connection string PostgreSQL para conexión Supabase interna (preferir Session pooler en Windows) |
| `SUPABASE_DB_URL` | Alias aceptado por `lib/sql/execute-query.ts` |
| `POSTGRES_URL` | Alias aceptado por `lib/sql/execute-query.ts` |
| `DB_CONNECTION_SECRET` | Cifrado de contraseñas de conexiones externas (preferido) |
| `AI_MASTER_SECRET` | Fallback para cifrado si no hay `DB_CONNECTION_SECRET` |
| `CRON_SECRET` | Autenticación del endpoint de sync programado |

Ejemplo en `.env.example`:

```env
# Supabase → Connect → Direct → Session pooler (puerto 5432)
DATABASE_URL=postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
```

---

## 9. Roles y RLS

Las políticas RLS usan valores del enum `app_role`:

- `administrador`, `analista`, `director_comercial`, `director_mercadeo`, `gerente_hotel`, `consulta`

**No existe** el rol `operador`. Las políticas de lectura para conexiones y fuentes SQL incluyen `gerente_hotel` además de `administrador` y `analista`.

---

## Relación con otros flujos de datos

| Fuente | `kpi_values.fuente` | Entrada a fórmula |
|--------|---------------------|-------------------|
| Registro manual | `manual` | UI / `variable_inputs` |
| Import Excel/CSV | `import` | Columnas `var_*` |
| Integración HTTP | `integracion` | Adapter JSON |
| SQL manual | `sql` | Resultado de consulta |
| SQL vía integración | `integracion` | `SqlDatabaseAdapter` |

Todos convergen en `computeKpiValueFromInputs` → `kpi_values`.
