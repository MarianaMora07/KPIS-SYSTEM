import { z } from "zod";

export const appRoleSchema = z.enum([
  "administrador",
  "director_comercial",
  "director_mercadeo",
  "gerente_hotel",
  "analista",
  "consulta",
]);

export const kpiCreateSchema = z.object({
  nombre: z.string().min(1).max(200),
  codigo: z.string().min(1).max(50).regex(/^[A-Z0-9_-]+$/i),
  categoria_id: z.string().uuid(),
  area_responsable: z.string().min(1).max(150),
  responsable_id: z.string().uuid().optional().nullable(),
  frecuencia: z.enum([
    "diaria",
    "semanal",
    "mensual",
    "trimestral",
    "semestral",
    "anual",
  ]),
  formula: z.string().max(2000).optional().nullable(),
  unidad_medida: z.string().min(1).max(50),
  meta: z.number().optional().nullable(),
  fuente_informacion: z.string().min(1).max(200),
  tipo_indicador: z.enum(["estrategico", "tactico", "operativo"]),
  hotel_id: z.string().uuid().optional().nullable(),
  region_id: z.string().uuid().optional().nullable(),
});

export const kpiTargetSchema = z.object({
  kpi_id: z.string().uuid(),
  periodo_tipo: z.enum([
    "mensual",
    "trimestral",
    "semestral",
    "anual",
    "especial",
  ]),
  fecha_inicio: z.string().date(),
  fecha_fin: z.string().date(),
  valor_meta: z.number(),
  hotel_id: z.string().uuid().optional().nullable(),
  region_id: z.string().uuid().optional().nullable(),
  descripcion: z.string().max(500).optional().nullable(),
});

export const importFileSchema = z.object({
  nombre_archivo: z.string().min(1).max(255),
  tipo_archivo: z.enum(["xlsx", "csv"]),
  plantilla_tipo: z.string().max(100).optional(),
});

export const kpiValueSchema = z.object({
  kpi_id: z.string().uuid(),
  fecha: z.string().date(),
  valor_real: z.number(),
  valor_meta: z.number().optional().nullable(),
  hotel_id: z.string().uuid().optional().nullable(),
  region_id: z.string().uuid().optional().nullable(),
});

export type KpiCreateInput = z.infer<typeof kpiCreateSchema>;
export type KpiTargetInput = z.infer<typeof kpiTargetSchema>;
export type ImportFileInput = z.infer<typeof importFileSchema>;
export type KpiValueInput = z.infer<typeof kpiValueSchema>;
