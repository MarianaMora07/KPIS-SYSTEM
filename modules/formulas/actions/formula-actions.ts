"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { saveKpiFormula } from "../services/formula-service";

export async function saveFormulaAction(kpiId: string, expresion: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  const result = await saveKpiFormula(kpiId, expresion, user.id);
  revalidatePath(`/kpis/${kpiId}`);
  return result;
}
