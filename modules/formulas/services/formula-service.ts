import { createClient } from "@/lib/supabase/server";
import { validateFormula } from "../utils/formula-engine";

export async function listVariables() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_variables")
    .select("*")
    .eq("estado", "activo")
    .order("codigo");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function createVariable(input: {
  codigo: string;
  nombre: string;
  tipo: "simple" | "compuesta";
  unidad_medida?: string;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_variables")
    .insert({ ...input, estado: "activo" })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function getKpiFormula(kpiId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_formulas")
    .select("*")
    .eq("kpi_id", kpiId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function saveKpiFormula(
  kpiId: string,
  expresion: string,
  userId: string
) {
  const variables = await listVariables();
  const codes = variables.map((v) => v.codigo);
  const validation = validateFormula(expresion, codes);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_formulas")
    .insert({
      kpi_id: kpiId,
      expresion,
      es_valida: validation.es_valida,
      validada_at: validation.es_valida ? new Date().toISOString() : null,
      created_by: userId,
      expresion_ast: { variables: codes.filter((c) => expresion.includes(c)) },
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  if (validation.es_valida) {
    await supabase.from("kpis").update({ formula: expresion }).eq("id", kpiId);
  }

  return { formula: data, validation };
}
