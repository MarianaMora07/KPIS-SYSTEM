const FORBIDDEN_KEYWORDS =
  /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|EXECUTE|CALL|COPY|MERGE|REPLACE)\b/i;

export function validateReadOnlySql(sql: string): { valid: boolean; error?: string } {
  const trimmed = sql.trim();
  if (!trimmed) {
    return { valid: false, error: "La consulta está vacía" };
  }
  if (!/^SELECT\b/i.test(trimmed)) {
    return { valid: false, error: "Solo se permiten consultas SELECT" };
  }
  if (trimmed.includes(";")) {
    return { valid: false, error: "No se permiten múltiples sentencias (;)" };
  }
  if (trimmed.includes("--") || trimmed.includes("/*")) {
    return { valid: false, error: "No se permiten comentarios en la consulta" };
  }
  if (FORBIDDEN_KEYWORDS.test(trimmed)) {
    return { valid: false, error: "La consulta contiene operaciones no permitidas" };
  }
  return { valid: true };
}
