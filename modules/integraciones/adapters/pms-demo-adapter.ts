import type {
  ExternalKpiRecord,
  IntegrationAdapter,
  IntegrationRecord,
} from "./types";

export class PmsDemoAdapter implements IntegrationAdapter {
  async fetchRecords(integration: IntegrationRecord): Promise<ExternalKpiRecord[]> {
    const res = await fetch(integration.endpoint_url, {
      headers: {
        Authorization: `Bearer ${(integration.auth_config as { token?: string }).token ?? "demo"}`,
      },
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);

    if (res?.ok) {
      const json = await res.json();
      if (Array.isArray(json)) {
        return json.map((row) => ({
          kpi_codigo: String(row.kpi_codigo ?? row.codigo ?? ""),
          valor: Number(row.valor ?? row.valor_real ?? 0),
          fecha: String(row.fecha ?? new Date().toISOString().slice(0, 10)),
          ...(row.variables && typeof row.variables === "object"
            ? { variables: row.variables as Record<string, number> }
            : {}),
        }));
      }
    }

    const fecha = new Date().toISOString().slice(0, 10);
    const mapping = integration.mapeo_campos ?? {};
    const defaults = [
      { key: "ocupacion", kpi: "OCP-001", base: 78 },
      { key: "revpar", kpi: "RVP-001", base: 138000 },
    ];

    return defaults.map(({ key, kpi, base }) => ({
      kpi_codigo: mapping[key] ?? kpi,
      valor: base + Math.random() * (base * 0.1),
      fecha,
    }));
  }
}

export function getAdapterFor(_tipo: string): IntegrationAdapter {
  return new PmsDemoAdapter();
}
