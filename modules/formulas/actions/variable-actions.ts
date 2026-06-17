"use server";

import { revalidatePath } from "next/cache";
import { assertPermission } from "@/lib/auth/require-permission";
import { createVariable } from "../services/formula-service";

function assertAdministrator(rol: string) {
  if (rol !== "administrador") {
    throw new Error("Solo un administrador puede gestionar variables de fórmula");
  }
}

export async function createVariableAction(input: {
  codigo: string;
  nombre: string;
  tipo: "simple" | "compuesta";
  unidad_medida?: string;
  formula_compuesta?: string;
}) {
  const { rol } = await assertPermission("kpis.editar");
  assertAdministrator(rol);

  try {
    await createVariable(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      throw new Error(`Ya existe una variable con el código "${input.codigo}"`);
    }
    if (msg.includes("row-level security")) {
      throw new Error(
        "No tiene permiso en base de datos para crear variables. Aplique la migración kpi_variables_formulas_rls o contacte al administrador."
      );
    }
    throw e;
  }
  revalidatePath("/kpis", "layout");
}
