export interface FormulaSuggestion {
  expresion: string;
  variable_codes: string[];
  reason: string;
}

function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function findVariable(
  variables: { codigo: string; nombre: string }[],
  keywords: string[]
): string | null {
  for (const variable of variables) {
    const haystack = normalize(`${variable.codigo} ${variable.nombre}`);
    if (keywords.some((keyword) => haystack.includes(keyword))) {
      return variable.codigo;
    }
  }
  return null;
}

function pickCodes(
  variables: { codigo: string; nombre: string }[],
  keywordsList: string[][]
): string[] {
  const picked: string[] = [];
  for (const keywords of keywordsList) {
    const code = findVariable(variables, keywords);
    if (code && !picked.includes(code)) picked.push(code);
  }
  return picked;
}

export function suggestKpiFormulaFallback(input: {
  kpi_nombre: string;
  unidad_medida?: string;
  area_responsable?: string;
  variables: { codigo: string; nombre: string; tipo: string }[];
}): FormulaSuggestion | null {
  const context = normalize(
    [input.kpi_nombre, input.unidad_medida, input.area_responsable].filter(Boolean).join(" ")
  );
  const variables = input.variables.filter((v) => v.tipo === "simple");

  if (variables.length === 0) return null;

  if (context.includes("ocupacion") || context.includes("occupancy")) {
    const codes = pickCodes(variables, [
      ["habitacion", "ocupad", "sold", "ocup"],
      ["disponib", "invent", "total", "hab"],
    ]);
    if (codes.length >= 2) {
      return {
        expresion: `${codes[0]} / ${codes[1]} * 100`,
        variable_codes: codes,
        reason: "Para ocupación, divida habitaciones ocupadas entre el total disponible y multiplique por 100.",
      };
    }
  }

  if (context.includes("conversion") || context.includes("tasa de conversion")) {
    const codes = pickCodes(variables, [
      ["reserva", "booking", "venta"],
      ["visita", "sesion", "trafico", "lead"],
    ]);
    if (codes.length >= 2) {
      return {
        expresion: `${codes[0]} / ${codes[1]} * 100`,
        variable_codes: codes,
        reason: "La conversión suele calcularse como reservas (o ventas) sobre visitas o leads, en porcentaje.",
      };
    }
  }

  if (context.includes("revpar")) {
    const codes = pickCodes(variables, [
      ["ingreso", "revenue", "venta"],
      ["habitacion", "disponib", "invent"],
    ]);
    if (codes.length >= 2) {
      return {
        expresion: `${codes[0]} / ${codes[1]}`,
        variable_codes: codes,
        reason: "RevPAR se aproxima como ingreso por habitaciones disponibles.",
      };
    }
  }

  if (context.includes("adr") || context.includes("tarifa")) {
    const codes = pickCodes(variables, [
      ["ingreso", "revenue"],
      ["noche", "habitacion", "room"],
    ]);
    if (codes.length >= 2) {
      return {
        expresion: `${codes[0]} / ${codes[1]}`,
        variable_codes: codes,
        reason: "ADR se calcula como ingreso dividido entre noches vendidas u habitaciones.",
      };
    }
  }

  if (context.includes("nps") || context.includes("satisfaccion")) {
    const promoters = findVariable(variables, ["promotor", "promoter"]);
    const detractors = findVariable(variables, ["detractor"]);
    const responses = findVariable(variables, ["respuesta", "encuesta", "total"]);
    if (promoters && detractors && responses) {
      return {
        expresion: `(${promoters} - ${detractors}) / ${responses} * 100`,
        variable_codes: [promoters, detractors, responses],
        reason: "NPS clásico: (promotores − detractores) / total respuestas × 100.",
      };
    }
  }

  if (input.unidad_medida === "%" && variables.length >= 2) {
    const [a, b] = variables;
    return {
      expresion: `${a.codigo} / ${b.codigo} * 100`,
      variable_codes: [a.codigo, b.codigo],
      reason: "Indicador en porcentaje: relación entre dos variables del catálogo, escalada a 100.",
    };
  }

  if (variables.length >= 2) {
    const [a, b] = variables;
    return {
      expresion: `${a.codigo} / ${b.codigo}`,
      variable_codes: [a.codigo, b.codigo],
      reason: "Relación simple entre las primeras variables disponibles; ajuste según la definición del KPI.",
    };
  }

  return null;
}
