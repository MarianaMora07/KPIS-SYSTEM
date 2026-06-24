import type { KpiFrequency, KpiIndicatorType } from "@/types/database";

export interface FrequencySuggestion {
  suggested: KpiFrequency;
  reason: string;
  alternatives: KpiFrequency[];
}

const FRECUENCIA_LABELS: Record<KpiFrequency, string> = {
  diaria: "Diaria",
  semanal: "Semanal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export function formatFrequencyLabel(frecuencia: KpiFrequency): string {
  return FRECUENCIA_LABELS[frecuencia];
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

const DAILY_KEYWORDS = [
  "ocupacion",
  "occupancy",
  "disponibilidad",
  "inventario",
  "check-in",
  "checkin",
  "diario",
  "daily",
];

const WEEKLY_KEYWORDS = ["semana", "weekly", "semanal", "revpar semanal"];

const MONTHLY_KEYWORDS = [
  "nps",
  "conversion",
  "leads",
  "reservas",
  "ingresos",
  "revenue",
  "adr",
  "tarifa",
  "satisfaccion",
  "encuesta",
];

const QUARTERLY_KEYWORDS = ["trimestre", "quarter", "estrateg", "market share"];

const ANNUAL_KEYWORDS = ["anual", "annual", "year", "vision", "plan estrategico"];

function matchKeywords(text: string, keywords: string[]): boolean {
  const normalized = normalize(text);
  return keywords.some((keyword) => normalized.includes(keyword));
}

function suggestionFromTipo(tipo: KpiIndicatorType): FrequencySuggestion {
  switch (tipo) {
    case "operativo":
      return {
        suggested: "semanal",
        reason: "Indicadores operativos suelen revisarse cada semana (o diariamente si el dato es en tiempo real).",
        alternatives: ["diaria", "mensual"],
      };
    case "tactico":
      return {
        suggested: "mensual",
        reason: "Indicadores tácticos se alinean con ciclos comerciales y de mercadeo mensuales.",
        alternatives: ["semanal", "trimestral"],
      };
    case "estrategico":
      return {
        suggested: "trimestral",
        reason: "Indicadores estratégicos suelen evaluarse por trimestre o semestre.",
        alternatives: ["semestral", "anual"],
      };
  }
}

export function suggestKpiFrequency(input: {
  tipo_indicador?: KpiIndicatorType | string;
  unidad_medida?: string;
  nombre?: string;
  area_responsable?: string;
}): FrequencySuggestion | null {
  const tipo = input.tipo_indicador as KpiIndicatorType | undefined;
  const context = [input.nombre, input.area_responsable, input.unidad_medida]
    .filter(Boolean)
    .join(" ");

  if (matchKeywords(context, DAILY_KEYWORDS)) {
    return {
      suggested: "diaria",
      reason: "Por el nombre o contexto del indicador, conviene medirlo a diario.",
      alternatives: ["semanal"],
    };
  }

  if (matchKeywords(context, WEEKLY_KEYWORDS)) {
    return {
      suggested: "semanal",
      reason: "El indicador encaja con un seguimiento semanal.",
      alternatives: ["diaria", "mensual"],
    };
  }

  if (matchKeywords(context, ANNUAL_KEYWORDS)) {
    return {
      suggested: "anual",
      reason: "Indicadores de planificación anual suelen revisarse una vez al año.",
      alternatives: ["semestral"],
    };
  }

  if (matchKeywords(context, QUARTERLY_KEYWORDS)) {
    return {
      suggested: "trimestral",
      reason: "El indicador se alinea con revisiones trimestrales.",
      alternatives: ["semestral", "mensual"],
    };
  }

  if (matchKeywords(context, MONTHLY_KEYWORDS)) {
    return {
      suggested: "mensual",
      reason: "Indicadores comerciales o de experiencia suelen reportarse mensualmente.",
      alternatives: ["semanal", "trimestral"],
    };
  }

  const unidad = normalize(input.unidad_medida ?? "");
  if (unidad.includes("%") || unidad.includes("pts") || unidad.includes("punto")) {
    return {
      suggested: "mensual",
      reason: "Porcentajes y puntajes de desempeño suelen consolidarse al cierre de mes.",
      alternatives: ["semanal", "trimestral"],
    };
  }

  if (tipo && ["estrategico", "tactico", "operativo"].includes(tipo)) {
    return suggestionFromTipo(tipo as KpiIndicatorType);
  }

  return null;
}
