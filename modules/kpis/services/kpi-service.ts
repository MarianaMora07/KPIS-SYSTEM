import { createClient } from "@/lib/supabase/server";
import type { KpiCreateInput } from "@/lib/validations/schemas";
import { kpiCreateSchema } from "@/lib/validations/schemas";

export async function listKpis() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpis")
    .select("*, kpi_categories(nombre)")
    .eq("estado", "activo")
    .order("nombre");

  if (error) throw new Error(error.message);
  return data;
}

export async function getKpiById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpis")
    .select("*, kpi_categories(nombre)")
    .eq("id", id)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function createKpi(input: KpiCreateInput) {
  const parsed = kpiCreateSchema.parse(input);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("kpis")
    .insert(parsed)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateKpi(id: string, input: Partial<KpiCreateInput>, userId: string) {
  const supabase = await createClient();
  const existing = await getKpiById(id);

  const { data, error } = await supabase
    .from("kpis")
    .update({
      ...input,
      updated_by: userId,
      version_actual: (existing.version_actual ?? 1) + 1,
    })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);

  await supabase.from("kpi_versions").insert({
    kpi_id: id,
    version: data.version_actual,
    snapshot: existing,
    changed_by: userId,
  });

  return data;
}

async function generateUniqueCodigo(
  supabase: Awaited<ReturnType<typeof createClient>>,
  baseCodigo: string
): Promise<string> {
  const root = baseCodigo.replace(/-COPY(-\d+)?$/i, "");
  let candidate = `${root}-COPY`;
  let n = 2;

  while (true) {
    const { data } = await supabase
      .from("kpis")
      .select("id")
      .eq("codigo", candidate)
      .maybeSingle();

    if (!data) return candidate;
    candidate = `${root}-COPY-${n}`;
    n++;
  }
}

export async function duplicateKpi(id: string, userId: string) {
  const supabase = await createClient();
  const source = await getKpiById(id);
  const codigo = await generateUniqueCodigo(supabase, source.codigo);

  const { data, error } = await supabase
    .from("kpis")
    .insert({
      nombre: `${source.nombre} (copia)`,
      codigo,
      categoria_id: source.categoria_id,
      area_responsable: source.area_responsable,
      responsable_id: source.responsable_id,
      frecuencia: source.frecuencia,
      formula: source.formula,
      unidad_medida: source.unidad_medida,
      meta: source.meta,
      fuente_informacion: source.fuente_informacion,
      tipo_indicador: source.tipo_indicador,
      hotel_id: source.hotel_id,
      region_id: source.region_id,
      business_unit_id: source.business_unit_id,
      sales_channel_id: source.sales_channel_id,
      marketing_campaign_id: source.marketing_campaign_id,
      commercial_team_id: source.commercial_team_id,
      duplicado_de_id: id,
      created_by: userId,
      updated_by: userId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);

  const { data: targets } = await supabase
    .from("kpi_targets")
    .select("*")
    .eq("kpi_id", id);

  if (targets?.length) {
    await supabase.from("kpi_targets").insert(
      targets.map((t) => ({
        kpi_id: data.id,
        periodo_tipo: t.periodo_tipo,
        fecha_inicio: t.fecha_inicio,
        fecha_fin: t.fecha_fin,
        valor_meta: t.valor_meta,
        hotel_id: t.hotel_id,
        region_id: t.region_id,
        descripcion: t.descripcion,
        created_by: userId,
      }))
    );
  }

  return data;
}

export async function listKpiVersions(kpiId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_versions")
    .select("*")
    .eq("kpi_id", kpiId)
    .order("version", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function listKpiValues(kpiId: string, limit = 100) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("kpi_values")
    .select("id, fecha, valor_real, valor_meta, cumplimiento_pct, semaforo")
    .eq("kpi_id", kpiId)
    .order("fecha", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function inactivateKpi(id: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("kpis")
    .update({ estado: "inactivo" })
    .eq("id", id);

  if (error) throw new Error(error.message);
}
