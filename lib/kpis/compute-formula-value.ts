import { computeKpiValueFromInputs } from "./formula-runtime";

/** @deprecated Use computeKpiValueFromInputs — mantiene compatibilidad con escalar. */
export async function computeKpiValueReal(
  kpiId: string,
  inputValor: number | Record<string, number>
): Promise<number> {
  const { valorReal } = await computeKpiValueFromInputs(kpiId, inputValor);
  return valorReal;
}

export { computeKpiValueFromInputs, getFormulaVariableCodes, getRequiredInputVariableCodes } from "./formula-runtime";
