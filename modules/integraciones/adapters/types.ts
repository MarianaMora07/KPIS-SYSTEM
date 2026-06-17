export interface IntegrationRecord {
  id: string;
  nombre: string;
  sistema_tipo: string;
  endpoint_url: string;
  auth_config: Record<string, unknown>;
  mapeo_campos: Record<string, string>;
  max_reintentos: number;
}

export interface ExternalKpiRecord {
  kpi_codigo: string;
  valor: number;
  fecha: string;
  variables?: Record<string, number>;
}

export interface IntegrationAdapter {
  fetchRecords(integration: IntegrationRecord): Promise<ExternalKpiRecord[]>;
}
