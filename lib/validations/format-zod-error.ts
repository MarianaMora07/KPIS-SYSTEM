import { ZodError } from "zod";

const FIELD_LABELS: Record<string, string> = {
  nombre: "Nombre",
  codigo: "Código",
  categoria_id: "Categoría",
  area_responsable: "Área responsable",
  frecuencia: "Frecuencia",
  unidad_medida: "Unidad de medida",
  fuente_informacion: "Fuente de información",
  tipo_indicador: "Tipo de indicador",
};

export function formatZodError(error: unknown): string {
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const field = String(first.path[0] ?? "");
    const label = FIELD_LABELS[field] ?? field;
    if (first.code === "too_small" || first.message.includes("Required")) {
      return `Complete el campo obligatorio: ${label}`;
    }
    if (field === "codigo" && first.message.toLowerCase().includes("codigo")) {
      return "El código solo puede contener letras, números, guiones y guiones bajos";
    }
    return first.message;
  }
  if (error instanceof Error) return error.message;
  return "Error de validación";
}
