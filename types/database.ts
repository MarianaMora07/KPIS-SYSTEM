export type AppRole =
  | "administrador"
  | "director_comercial"
  | "director_mercadeo"
  | "gerente_hotel"
  | "analista"
  | "consulta";

export type TrafficLightStatus =
  | "cumplimiento"
  | "riesgo"
  | "incumplimiento";

export type EntityStatus = "activo" | "inactivo";

export type KpiFrequency =
  | "diaria"
  | "semanal"
  | "mensual"
  | "trimestral"
  | "semestral"
  | "anual";

export type KpiIndicatorType = "estrategico" | "tactico" | "operativo";

export interface Database {
  public: {
    Tables: {
      regions: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          descripcion: string | null;
          estado: EntityStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["regions"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["regions"]["Row"],
            "codigo" | "nombre"
          >;
        Update: Partial<Database["public"]["Tables"]["regions"]["Row"]>;
      };
      hotels: {
        Row: {
          id: string;
          region_id: string;
          codigo: string;
          nombre: string;
          ciudad: string | null;
          estado: EntityStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["hotels"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["hotels"]["Row"],
            "region_id" | "codigo" | "nombre"
          >;
        Update: Partial<Database["public"]["Tables"]["hotels"]["Row"]>;
      };
      kpi_categories: {
        Row: {
          id: string;
          codigo: string;
          nombre: string;
          descripcion: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kpi_categories"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["kpi_categories"]["Row"],
            "codigo" | "nombre"
          >;
        Update: Partial<Database["public"]["Tables"]["kpi_categories"]["Row"]>;
      };
      kpis: {
        Row: {
          id: string;
          nombre: string;
          codigo: string;
          categoria_id: string;
          area_responsable: string;
          responsable_id: string | null;
          frecuencia: KpiFrequency;
          formula: string | null;
          unidad_medida: string;
          meta: number | null;
          fuente_informacion: string;
          tipo_indicador: KpiIndicatorType;
          hotel_id: string | null;
          region_id: string | null;
          business_unit_id: string | null;
          sales_channel_id: string | null;
          marketing_campaign_id: string | null;
          commercial_team_id: string | null;
          estado: EntityStatus;
          version_actual: number;
          duplicado_de_id: string | null;
          created_by: string | null;
          updated_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kpis"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["kpis"]["Row"],
            | "nombre"
            | "codigo"
            | "categoria_id"
            | "area_responsable"
            | "frecuencia"
            | "unidad_medida"
            | "fuente_informacion"
            | "tipo_indicador"
          >;
        Update: Partial<Database["public"]["Tables"]["kpis"]["Row"]>;
      };
      kpi_values: {
        Row: {
          id: string;
          kpi_id: string;
          hotel_id: string | null;
          region_id: string | null;
          fecha: string;
          valor_real: number;
          valor_meta: number | null;
          cumplimiento_pct: number | null;
          semaforo: TrafficLightStatus | null;
          fuente: string;
          integration_id: string | null;
          variable_inputs?: Record<string, number> | null;
          calculated_at: string;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["kpi_values"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["kpi_values"]["Row"],
            "kpi_id" | "fecha" | "valor_real"
          >;
        Update: Partial<Database["public"]["Tables"]["kpi_values"]["Row"]>;
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          nombre: string;
          apellido: string | null;
          telefono: string | null;
          activo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_profiles"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["user_profiles"]["Row"],
            "id" | "email" | "nombre"
          >;
        Update: Partial<Database["public"]["Tables"]["user_profiles"]["Row"]>;
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          rol: AppRole;
          asignado_por: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["user_roles"]["Row"]> &
          Pick<
            Database["public"]["Tables"]["user_roles"]["Row"],
            "user_id" | "rol"
          >;
        Update: Partial<Database["public"]["Tables"]["user_roles"]["Row"]>;
      };
      audit_logs: {
        Row: {
          id: string;
          usuario_id: string | null;
          usuario_email: string | null;
          fecha: string;
          hora: string;
          accion: string;
          entidad: string;
          entidad_id: string | null;
          valor_anterior: Record<string, unknown> | null;
          valor_nuevo: Record<string, unknown> | null;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      import_jobs: {
        Row: {
          id: string;
          usuario_id: string;
          nombre_archivo: string;
          tipo_archivo: "xlsx" | "csv";
          plantilla_tipo: string | null;
          estado: string;
          total_filas: number | null;
          filas_ok: number | null;
          filas_error: number | null;
          storage_path: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          usuario_id: string;
          nombre_archivo: string;
          tipo_archivo: "xlsx" | "csv";
          plantilla_tipo?: string | null;
          estado?: string;
        };
        Update: Partial<Database["public"]["Tables"]["import_jobs"]["Row"]>;
      };
      external_integrations: {
        Row: {
          id: string;
          nombre: string;
          sistema_tipo: string;
          endpoint_url: string;
          activa: boolean;
          created_at: string;
        };
        Insert: never;
        Update: never;
      };
      integration_jobs: {
        Row: {
          id: string;
          integration_id: string;
          estado: string;
          created_at: string;
        };
        Insert: {
          integration_id: string;
          estado?: string;
        };
        Update: Partial<Database["public"]["Tables"]["integration_jobs"]["Row"]>;
      };
    };
    Views: {
      v_kpi_values_semaforizado: {
        Row: Database["public"]["Tables"]["kpi_values"]["Row"] & {
          semaforo_calculado: TrafficLightStatus | null;
        };
      };
    };
    Functions: Record<string, never>;
    Enums: {
      app_role: AppRole;
      traffic_light_status: TrafficLightStatus;
      entity_status: EntityStatus;
      kpi_frequency: KpiFrequency;
      kpi_indicator_type: KpiIndicatorType;
    };
  };
}
