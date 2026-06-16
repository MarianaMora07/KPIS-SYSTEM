import { create, all } from "mathjs";

const math = create(all, {});

export function validateFormula(
  expresion: string,
  variableCodes: string[]
): { es_valida: boolean; errores: string[] } {
  const errores: string[] = [];
  if (!expresion.trim()) {
    return { es_valida: false, errores: ["La expresión no puede estar vacía"] };
  }

  try {
    const node = math.parse(expresion);
    const used = new Set<string>();
    node.traverse((n) => {
      if (n.type === "SymbolNode" && "name" in n) {
        used.add((n as { name: string }).name);
      }
    });

    for (const sym of used) {
      if (!variableCodes.includes(sym)) {
        errores.push(`Variable desconocida: ${sym}`);
      }
    }

    const scope: Record<string, number> = {};
    for (const code of variableCodes) scope[code] = 1;
    math.evaluate(expresion, scope);

    return { es_valida: errores.length === 0, errores };
  } catch (e) {
    return {
      es_valida: false,
      errores: [e instanceof Error ? e.message : "Expresión inválida"],
    };
  }
}

export function evaluateFormula(
  expresion: string,
  values: Record<string, number>
): number {
  return math.evaluate(expresion, values) as number;
}
