export interface SqlClauses {
  select: string;
  from: string;
  where?: string | null;
  groupBy?: string | null;
  having?: string | null;
  orderBy?: string | null;
  distinct?: boolean;
}

export const SQL_QUERY_LIMIT = 1000;

export function buildStructuredSql(clauses: SqlClauses): string {
  const selectPart = clauses.select?.trim();
  const fromPart = clauses.from?.trim();
  if (!selectPart) throw new Error("SELECT es obligatorio");
  if (!fromPart) throw new Error("FROM es obligatorio");

  const parts: string[] = [];
  parts.push(clauses.distinct ? "SELECT DISTINCT" : "SELECT");
  parts.push(selectPart);
  parts.push("FROM");
  parts.push(fromPart);

  const where = clauses.where?.trim();
  if (where) {
    parts.push("WHERE");
    parts.push(where);
  }

  const groupBy = clauses.groupBy?.trim();
  if (groupBy) {
    parts.push("GROUP BY");
    parts.push(groupBy);
  }

  const having = clauses.having?.trim();
  if (having) {
    parts.push("HAVING");
    parts.push(having);
  }

  const orderBy = clauses.orderBy?.trim();
  if (orderBy) {
    parts.push("ORDER BY");
    parts.push(orderBy);
  }

  return parts.join(" ");
}

export function appendQueryLimit(sql: string, limit = SQL_QUERY_LIMIT): string {
  const normalized = sql.trim();
  if (/\bLIMIT\s+\d+/i.test(normalized)) {
    return normalized;
  }
  return `${normalized} LIMIT ${limit}`;
}

export function sqlClausesFromKpiSource(row: {
  clause_select: string;
  clause_from: string;
  clause_where?: string | null;
  clause_group_by?: string | null;
  clause_having?: string | null;
  clause_order_by?: string | null;
  distinct_rows?: boolean;
}): SqlClauses {
  return {
    select: row.clause_select,
    from: row.clause_from,
    where: row.clause_where,
    groupBy: row.clause_group_by,
    having: row.clause_having,
    orderBy: row.clause_order_by,
    distinct: row.distinct_rows ?? false,
  };
}
