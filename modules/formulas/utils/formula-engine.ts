import { create, all } from "mathjs";

const math = create(all, {});

const RESERVED_SYMBOLS = new Set([
  "true",
  "false",
  "null",
  "undefined",
  "Infinity",
  "NaN",
  "e",
  "pi",
]);

export function extractUsedSymbols(expresion: string): string[] {
  const used = new Set<string>();
  try {
    const node = math.parse(expresion);
    node.traverse((n) => {
      if (n.type === "SymbolNode" && "name" in n) {
        const name = (n as { name: string }).name;
        if (!RESERVED_SYMBOLS.has(name)) used.add(name);
      }
    });
  } catch {
    return [];
  }
  return [...used];
}

export function validateFormula(
  expresion: string,
  variableCodes: string[]
): { es_valida: boolean; errores: string[] } {
  const errores: string[] = [];
  if (!expresion.trim()) {
    return { es_valida: false, errores: ["La expresión no puede estar vacía"] };
  }

  try {
    const used = extractUsedSymbols(expresion);

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

export interface VariableDefinition {
  codigo: string;
  tipo: "simple" | "compuesta";
  formula_compuesta?: string | null;
}

/** Valida formula_compuesta de una variable compuesta (solo referencias a simples). */
export function validateCompositeFormula(
  formulaCompuesta: string,
  simpleCodes: string[],
  selfCode?: string
): { es_valida: boolean; errores: string[] } {
  const errores: string[] = [];
  if (!formulaCompuesta.trim()) {
    return { es_valida: false, errores: ["La fórmula compuesta no puede estar vacía"] };
  }

  const used = extractUsedSymbols(formulaCompuesta);
  if (selfCode && used.includes(selfCode)) {
    errores.push(`La variable no puede referenciarse a sí misma: ${selfCode}`);
  }

  for (const sym of used) {
    if (!simpleCodes.includes(sym)) {
      errores.push(
        `En fórmula compuesta solo se permiten variables simples. Desconocida: ${sym}`
      );
    }
  }

  try {
    const scope: Record<string, number> = {};
    for (const code of simpleCodes) scope[code] = 1;
    math.evaluate(formulaCompuesta, scope);
  } catch (e) {
    errores.push(e instanceof Error ? e.message : "Expresión compuesta inválida");
  }

  return { es_valida: errores.length === 0, errores };
}

/** Detecta ciclos en dependencias entre variables compuestas. */
export function detectCompositeCycles(
  variables: VariableDefinition[]
): string | null {
  const composite = variables.filter((v) => v.tipo === "compuesta");
  const graph = new Map<string, string[]>();

  for (const v of composite) {
    if (!v.formula_compuesta) continue;
    graph.set(
      v.codigo,
      extractUsedSymbols(v.formula_compuesta).filter((s) =>
        composite.some((c) => c.codigo === s)
      )
    );
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();

  function dfs(node: string): boolean {
    if (visiting.has(node)) return true;
    if (visited.has(node)) return false;
    visiting.add(node);
    for (const dep of graph.get(node) ?? []) {
      if (dfs(dep)) return true;
    }
    visiting.delete(node);
    visited.add(node);
    return false;
  }

  for (const code of graph.keys()) {
    if (dfs(code)) {
      return `Dependencia circular detectada en variables compuestas (involucra ${code})`;
    }
  }
  return null;
}

export function evaluateFormula(
  expresion: string,
  values: Record<string, number>
): number {
  const result = math.evaluate(expresion, values);
  if (typeof result !== "number" || !Number.isFinite(result)) {
    throw new Error("La fórmula no produjo un número válido");
  }
  return result;
}

export function resolveVariableScope(
  inputs: Record<string, number>,
  variables: VariableDefinition[]
): Record<string, number> {
  const scope: Record<string, number> = {};
  const simples = variables.filter((v) => v.tipo === "simple");
  const compuestas = variables.filter((v) => v.tipo === "compuesta");

  for (const v of simples) {
    if (inputs[v.codigo] != null) {
      scope[v.codigo] = inputs[v.codigo];
    }
  }

  const pending = [...compuestas];
  let guard = pending.length + 1;
  while (pending.length > 0 && guard-- > 0) {
    for (let i = pending.length - 1; i >= 0; i--) {
      const v = pending[i];
      if (!v.formula_compuesta) {
        pending.splice(i, 1);
        continue;
      }
      const deps = extractUsedSymbols(v.formula_compuesta);
      const allResolved = deps.every((d) => scope[d] != null);
      if (!allResolved) continue;

      scope[v.codigo] = evaluateFormula(v.formula_compuesta, scope);
      pending.splice(i, 1);
    }
  }

  for (const v of pending) {
    if (scope[v.codigo] == null) {
      throw new Error(`No se pudo resolver la variable compuesta: ${v.codigo}`);
    }
  }

  return scope;
}
