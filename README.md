# Sistema KPIs — Hoteles Estelar

Plataforma de gestión de indicadores comerciales (KPIs) para la cadena hotelera Estelar. Cubre las 12 historias de usuario del documento funcional: administración de KPIs, importación, integraciones, dashboard analítico, alertas, reportes ejecutivos y seguridad RBAC.

## Arquitectura

```
Next.js 16 (App Router)
├── app/(dashboard)/     — UI autenticada
├── app/api/             — REST endpoints (import, integraciones, cron, alertas)
├── modules/             — Dominio por feature (kpis, dashboard, alertas, …)
├── lib/
│   ├── supabase/        — Cliente server/browser
│   ├── auth/            — Permisos y sesión
│   ├── activepieces/    — Webhooks automatización
│   ├── gemini/          — Resúmenes IA
│   └── cache/           — Cache in-memory dashboard (TTL 60s)
└── supabase/migrations/ — PostgreSQL + RLS + triggers
```

**Stack:** Next.js, TypeScript, Tailwind, Supabase (PostgreSQL + Auth + Storage), Recharts, Activepieces, Gemini.

## Setup local

1. Clonar e instalar dependencias:

```bash
npm install
```

2. Copiar variables de entorno:

```bash
cp .env.example .env.local
```

3. Configurar Supabase (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) y ejecutar migraciones:

```bash
npm run db:reset   # local con Supabase CLI
# o: supabase db push  (remoto)
```

4. Iniciar desarrollo:

```bash
npm run dev
```

5. Registrarse en `/login`. El primer usuario recibe rol `analista` automáticamente.

## Módulos principales

| Ruta | HU | Descripción |
|------|-----|-------------|
| `/dashboard` | 006/007 | Tarjetas KPI, tendencias, comparativos, proyección lineal |
| `/kpis` | 001 | CRUD, duplicar, versionar, detalle `/kpis/[id]` |
| `/import` | 004 | Plantilla Excel, preview, jobs async |
| `/integraciones` | 005 | CRUD PMS/CRM, sync con reintentos, cron |
| `/alertas` | 008/009 | Alertas, planes de acción, escalamiento auto 48h |
| `/reportes` | 010 | PDF, Excel, PowerPoint, programación cron |
| `/seguridad` | 011 | Usuarios, roles y scopes |
| `/auditoria` | 012 | Bitácora de trazabilidad |
| `/catalogo` | — | Regiones, hoteles, canales, campañas |

## Automatización (Activepieces)

Ver [`docs/activepieces-workflows.md`](docs/activepieces-workflows.md) para configurar webhooks:

- `kpi.alert.created` / `kpi.alert.escalated`
- `integration.failed`
- `report.scheduled`

## Cron jobs (Vercel / externo)

Configurar `CRON_SECRET` y llamar con `Authorization: Bearer <CRON_SECRET>`:

| Endpoint | Frecuencia sugerida |
|----------|---------------------|
| `GET /api/cron/escalate-alerts` | Diario |
| `POST /api/integraciones/cron` | Según integraciones |
| `POST /api/cron/reports` | Semanal |

## Deploy en Vercel

1. Conectar repositorio en Vercel.
2. Añadir variables de `.env.example`.
3. Configurar cron en `vercel.json` (opcional).
4. Ejecutar migraciones en Supabase remoto.

## Scripts útiles

```bash
npm run dev          # Desarrollo
npm run build        # Build producción
npm run db:reset     # Reset BD local
npm run db:types     # Generar tipos TypeScript desde Supabase
```

## Demo

Guion de presentación en [`docs/demo-script.md`](docs/demo-script.md).
