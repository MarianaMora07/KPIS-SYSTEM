# Guion de demo — Sistema KPIs Estelar

Duración estimada: 15–20 minutos.

## 1. Login y contexto (2 min)

- Abrir `/login` e iniciar sesión como administrador o analista.
- Mencionar RBAC: 6 roles, scopes por hotel/región.

## 2. Dashboard ejecutivo (3 min)

- Ir a `/dashboard`.
- Mostrar filtros región/hotel en el header.
- Tarjetas KPI con semáforo (cumplimiento / riesgo / incumplimiento).
- Gráficos: tendencias con línea de proyección (estimación lineal).
- Comparativo mes vs mes / año vs año.
- Click en tarjeta → drill-down con mini gráfico.
- Campana de notificaciones (alertas activas).

## 3. Administración KPIs (3 min)

- `/kpis` → Crear KPI con catálogo completo (hotel, canal, campaña).
- Ver detalle `/kpis/[id]`: metas, semáforo, fórmula, versiones.
- Editar y duplicar KPI.
- Registrar valor manual (dispara alerta si incumple).

## 4. Importación (2 min)

- `/import` → Descargar plantilla Excel.
- Subir archivo → preview primeras filas → job async con errores por fila.
- Historial de importaciones del usuario.

## 5. Integraciones (2 min)

- `/integraciones` → Crear integración PMS demo.
- Sincronizar ahora → ver jobs y logs.
- Mencionar cron automático y notificación Activepieces en fallo.

## 6. Alertas y planes (3 min)

- `/alertas` → pestaña alertas activas.
- Crear plan de acción desde alerta.
- Pestaña planes: progreso ítems, cambio de estado.
- Escalamiento automático tras 48h sin plan (cron).

## 7. Reportes (2 min)

- `/reportes` → Vista previa tabla.
- Exportar PDF (con resumen Gemini), Excel, PowerPoint.
- Programación semanal vía `scheduled_reports` + cron.

## 8. Seguridad y catálogo (2 min)

- `/seguridad` → usuarios, roles, bitácora auditoría.
- `/catalogo` → jerarquía organizacional.

## Cierre

- Resumen: datos en Supabase, automatización Activepieces, IA Gemini opcional.
- Deploy Vercel + variables en `.env.example`.
