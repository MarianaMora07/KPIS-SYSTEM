# Arquitectura KPI: fórmulas y desglose

## Principio rector

**Un indicador = una fórmula versionada.** El desglose (hotel, región, canal, campaña, etc.) vive en **valores y metas**, no en la definición del cálculo.

```
Capa 1 — Definición     kpis + kpi_formulas (expresión única por KPI)
Capa 2 — Desglose       kpi_values / kpi_targets (dimensiones organizacionales)
Capa 3 — Entrada        variable_inputs + registro manual (datos que alimentan la fórmula)
```

## Fórmula estática por KPI

- Tabla `kpi_formulas`: versionada en el tiempo (`version`, `es_valida`), **sin columnas de dimensión**.
- Runtime: `computeKpiValueFromInputs(kpiId, inputs)` en `lib/kpis/formula-runtime.ts` — no recibe hotel/región/canal.
- Al registrar un valor con fórmula, el sistema calcula `valor_real` con la expresión vigente; las dimensiones solo etiquetan **dónde** aplica ese valor.

## Desglose operativo

Dimensiones soportadas en `kpi_values`:

| Campo | Uso |
|-------|-----|
| `hotel_id` | Propiedad / hotel |
| `region_id` | Región comercial |
| `business_unit_id` | Unidad de negocio |
| `sales_channel_id` | Canal de venta |
| `marketing_campaign_id` | Campaña |
| `commercial_team_id` | Equipo comercial |

Al registrar un valor, se heredan los defaults del KPI y pueden ajustarse si el indicador no tiene una dimensión fijada.

Metas (`kpi_targets`) usan hotel, región y campaña para acotar el alcance de la meta al comparar con valores.

## Flexibilidad sin multi-fórmula

| Necesidad | Solución |
|-----------|----------|
| Sub-cálculos reutilizables | Variables **compuestas** en `kpi_variables` |
| Metodología distinta en el tiempo | **Versionado** de `kpi_formulas` |
| Métrica genuinamente distinta | **Nuevo KPI** (nuevo código), no otra fórmula bajo el mismo código |
| Distintos datos por hotel/canal | Misma fórmula + distintos `variable_inputs` y desglose en el valor |

## Multi-fórmula por desglose — pospuesto

No implementar fórmulas distintas por hotel/región/canal como diseño base. Rompe comparabilidad entre propiedades y complica agregaciones.

Si en el futuro un caso de negocio lo exige (p. ej. franquicias con normativa distinta), evaluar **perfiles de cálculo** explícitos y documentados — nunca mezclar perfiles en el mismo ranking sin etiquetar.

## Referencias de código

- Evaluación: `lib/kpis/formula-runtime.ts`
- Persistencia de fórmula: `modules/formulas/services/formula-service.ts` → `saveKpiFormula`
- Desglose en valores: `lib/kpis/dimension-scope.ts`
- Registro: `modules/kpis/actions/kpi-actions.ts` → `registerKpiValueAction`
