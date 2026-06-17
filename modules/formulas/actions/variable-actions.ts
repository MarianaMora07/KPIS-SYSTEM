"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { assertPermission } from "@/lib/auth/require-permission";
import { createVariable } from "../services/formula-service";

export async function createVariableAction(input: {
  codigo: string;
  nombre: string;
  tipo: "simple" | "compuesta";
  unidad_medida?: string;
}) {
  await assertPermission("kpis.editar");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");

  try {
    await createVariable(input);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (msg.includes("duplicate") || msg.includes("unique")) {
      throw new Error(`Ya existe una variable con el código "${input.codigo}"`);
    }
    throw e;
  }
  revalidatePath("/kpis");
}
