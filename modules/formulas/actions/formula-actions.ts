"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/require-permission";
import { saveKpiFormula } from "../services/formula-service";

export async function saveFormulaAction(kpiId: string, expresion: string) {
  const { rol } = await assertPermission("kpis.editar");
  if (rol !== "administrador") {
    throw new Error("Solo un administrador puede configurar fórmulas de KPI");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const result = await saveKpiFormula(kpiId, expresion, user.id);
  revalidatePath(`/kpis/${kpiId}`);
  revalidatePath("/kpis", "layout");
  return result;
}
