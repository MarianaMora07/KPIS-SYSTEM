# Workflows Activepieces — Sistema KPIs Estelar

Automatización de notificaciones para **HU-KPI-005** (errores de integración), **HU-KPI-008** (alertas automáticas, correos y escalamiento) y **RF-05/06** (flujo de aprobaciones KPI).

## Configuración en la app

En `.env.local`:

```env
# URL del trigger Webhook del flow principal (recomendado: un solo flow con Router)
ACTIVEPIECES_WEBHOOK_URL=https://cloud.activepieces.com/api/v1/webhooks/XXXXXXXX

# Opcional: secreto compartido (header x-webhook-secret en el flow)
ACTIVEPIECES_WEBHOOK_SECRET=

# Opcional: un flow separado por evento (sobrescribe la URL por defecto)
# ACTIVEPIECES_WEBHOOK_URL_KPI_ALERT_CREATED=
# ACTIVEPIECES_WEBHOOK_URL_KPI_ALERT_ESCALATED=
# ACTIVEPIECES_WEBHOOK_URL_IMPORT_COMPLETED=
# ACTIVEPIECES_WEBHOOK_URL_IMPORT_FAILED=
# ACTIVEPIECES_WEBHOOK_URL_INTEGRATION_FAILED=
# ACTIVEPIECES_WEBHOOK_URL_KPI_REVIEW_DUE=
# ACTIVEPIECES_WEBHOOK_URL_KPI_APPROVAL_REQUESTED=
# ACTIVEPIECES_WEBHOOK_URL_KPI_APPROVAL_APPROVED=
# ACTIVEPIECES_WEBHOOK_URL_KPI_APPROVAL_REJECTED=
```

La app envía **POST JSON** a la URL configurada. El campo `event` identifica el tipo de notificación.

## Eventos disponibles

| Evento | Payload | Cuándo se dispara | Historia de usuario |
|--------|---------|-------------------|---------------------|
| `kpi.alert.created` | `alertId`, `kpiId`, `hotelId`, `severidad`, `mensaje` | Nuevo valor KPI en riesgo/incumplimiento | HU-KPI-008 |
| `kpi.alert.escalated` | `alertId`, `kpiId`, `mensaje`, `severidad` | Usuario escala alerta manualmente | HU-KPI-008 |
| `import.completed` | `jobId`, `estado`, `totalFilas`, `filasOk`, `filasError`, `nombreArchivo` | Importación finaliza | HU-KPI-004 |
| `import.failed` | `jobId`, `error` | Importación falla por completo | HU-KPI-004 |
| `integration.failed` | `jobId`, `integrationId`, `integrationNombre`, `error` | Job de integración agota reintentos | HU-KPI-005 |
| `report.scheduled` | `scheduleId`, `nombre`, `formato`, `emails`, `rowCount` | Cron ejecuta reportes programados (`POST /api/cron/reports`) | HU-KPI-010 |
| `kpi.review.due` | `kpiId`, `kpiCodigo`, `kpiNombre`, `frecuencia`, `emails`, `mensaje`, `kpiUrl`, `lastValueDate` | Cron diario: KPI sin valor reciente según su frecuencia (`GET /api/cron/kpi-review-reminders`) | HU-KPI-008 |
| `kpi.approval.requested` | `requestId`, `tipo`, `tipoLabel`, `hotelNombre`, `kpiCodigo`, `kpiNombre`, `solicitanteNombre`, `notifyEmails`, `resumen`, `approvalUrl` | Analista envía solicitud de creación, edición o medición | RF-05/06 |
| `kpi.approval.approved` | `requestId`, `tipoLabel`, `kpiCodigo`, `solicitanteEmail`, `aprobadorNombre`, `mensaje`, `kpiUrl` | Aprobador aprueba la solicitud | RF-05/06 |
| `kpi.approval.rejected` | `requestId`, `tipoLabel`, `kpiCodigo`, `solicitanteEmail`, `aprobadorNombre`, `observaciones`, `resumen`, `approvalUrl` | Aprobador rechaza con observaciones | RF-05/06 |

Todos los payloads incluyen `event` y `timestamp` (ISO 8601).

---

## Enfoque recomendado: un flow con Router

### 1. Crear el flow

1. En Activepieces: **Flows → Create flow**
2. Trigger: **Webhook** → copiar la URL generada a `ACTIVEPIECES_WEBHOOK_URL`
3. Publicar el flow (los webhooks solo procesan flows publicados)

### 2. Router por `event`

Añadir pieza **Router** con ramas según `trigger.body.event`:

| Rama | Condición | Acción |
|------|-----------|--------|
| Alerta creada | `event` = `kpi.alert.created` | Ver [activepieces-alertas.md](./activepieces-alertas.md) (pasos 3–5) |
| Alerta escalada | `event` = `kpi.alert.escalated` | Ver [activepieces-alertas.md](./activepieces-alertas.md) (paso 6) |
| Import OK | `event` = `import.completed` | Ver [activepieces-import-integracion.md](./activepieces-import-integracion.md) §1 |
| Import fallido | `event` = `import.failed` | Ver [activepieces-import-integracion.md](./activepieces-import-integracion.md) §2 |
| Integración fallida | `event` = `integration.failed` | Ver [activepieces-import-integracion.md](./activepieces-import-integracion.md) §3 |
| Reporte programado | `event` = `report.scheduled` | Ver [activepieces-report-scheduled.md](./activepieces-report-scheduled.md) |
| Recordatorio KPI | `event` = `kpi.review.due` | Ver workflow 4 |
| Aprobación pendiente | `event` = `kpi.approval.requested` | Ver [activepieces-aprobaciones.md](./activepieces-aprobaciones.md) §1 |
| Aprobación aprobada | `event` = `kpi.approval.approved` | Ver [activepieces-aprobaciones.md](./activepieces-aprobaciones.md) §2 |
| Aprobación rechazada | `event` = `kpi.approval.rejected` | Ver [activepieces-aprobaciones.md](./activepieces-aprobaciones.md) §3 |

En el editor de expresiones de Activepieces, el cuerpo del webhook suele estar en `{{trigger.body}}` o `{{step_1.body}}` según la versión.

---

## Workflows de alertas (HU-KPI-008)

Toda la configuración paso a paso (Webhook → Router → Gmail Crítico / Riesgo / Escalada) está en **[activepieces-alertas.md](./activepieces-alertas.md)**.

---

## Workflows de aprobaciones (RF-05/06)

Tres ramas para notificar aprobadores y analistas (solicitud pendiente, aprobada, rechazada) están en **[activepieces-aprobaciones.md](./activepieces-aprobaciones.md)** — incluye JSON de prueba PowerShell y plantillas HTML por rama.

---

## Workflow 2: Import completado (HU-KPI-004)

**Rama:** `import.completed`

1. **Send Email** — Resumen: `filasOk` / `filasError` / `nombreArchivo`
2. **Branch (IF)** — `{{trigger.body.filasError}}` > 0
3. Si hay errores → notificar también al canal de operaciones

### Payload de ejemplo

```json
{
  "event": "import.completed",
  "timestamp": "2026-06-15T10:00:00.000Z",
  "jobId": "uuid",
  "estado": "parcial",
  "totalFilas": 100,
  "filasOk": 95,
  "filasError": 5,
  "nombreArchivo": "kpis_junio.xlsx"
}
```

---

## Workflow 2b: Import fallido

**Rama:** `import.failed`

1. **Send Email / Slack** — Asunto: `Importación fallida — job {{trigger.body.jobId}}`
2. Cuerpo: `{{trigger.body.error}}`

---

## Workflow 3: Integración fallida (HU-KPI-005)

**Rama:** `integration.failed`

1. **Send Email / Slack** — Notificar al administrador
2. Incluir: `integrationNombre`, `integrationId`, `error`, `jobId`
3. En Activepieces: activar **Retry on failure** (3 intentos, 5 min) en el flow o en la pieza de email

---

## Workflow 4: Recordatorio revisión KPI (frecuencia)

**Rama:** `kpi.review.due`

1. **Send Email** — Destinatarios: `{{trigger.body.emails}}` (array)
2. Asunto: `Recordatorio KPI — {{trigger.body.kpiCodigo}}`
3. Cuerpo sugerido:
   - `{{trigger.body.mensaje}}`
   - Enlace: `{{trigger.body.kpiUrl}}`
   - Frecuencia: `{{trigger.body.frecuencia}}`
   - Último valor: `{{trigger.body.lastValueDate}}`

### Payload de ejemplo

```json
{
  "event": "kpi.review.due",
  "timestamp": "2026-06-21T08:00:00.000Z",
  "kpiId": "uuid",
  "kpiCodigo": "NPS-001",
  "kpiNombre": "NPS",
  "frecuencia": "mensual",
  "emails": ["gerente@estelar.com"],
  "mensaje": "Es momento de registrar el valor del KPI NPS-001...",
  "kpiUrl": "https://app/kpis/uuid?tab=seguimiento",
  "lastValueDate": null
}
```

---

## Manejo de errores

- Configura **Flow run notifications** en Activepieces para avisar si el flow falla
- La app usa fire-and-forget (timeout 3 s); si Activepieces no responde, el flujo principal de KPIs no se bloquea
- Timeout recomendado en el trigger Webhook de Activepieces: 30 s

## Prueba local

Tras publicar el flow:

```bash
curl -X POST "$ACTIVEPIECES_WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "kpi.alert.created",
    "timestamp": "2026-06-15T10:00:00.000Z",
    "alertId": "test",
    "kpiId": "test",
    "severidad": "critico",
    "mensaje": "Prueba desde curl"
  }'
```

Verifica la ejecución en **Runs** del flow en Activepieces.

## Alternativa: un flow por evento

Si prefieres flows independientes en lugar del Router:

1. Crea un flow con trigger Webhook por cada evento
2. Asigna cada URL a la variable `ACTIVEPIECES_WEBHOOK_URL_*` correspondiente
3. No es necesario configurar `ACTIVEPIECES_WEBHOOK_URL` global
