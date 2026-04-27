import { drizzle } from "drizzle-orm/sqlite-proxy";

type OoDbLike = {
  exec: (
    sql: string,
    opts?: {
      bind?: unknown[];
      returnValue?: "this" | "resultRows" | "saveSql";
      rowMode?: "array" | "object";
    },
  ) => unknown;
};

type StmtLike = {
  bind: (values: unknown[]) => StmtLike;
  stepReset: () => StmtLike;
};

export const createDrizzleDb = (
  getDb: () => OoDbLike,
  getStmt: (sql: string) => StmtLike,
) => {
  return drizzle((sql, params, method) => {
    if (method === "run") {
      getStmt(sql)
        .bind(params as unknown[])
        .stepReset();
      return Promise.resolve({ rows: [] });
    }

    const rows = getDb().exec(sql, {
      bind: params as unknown[],
      returnValue: "resultRows",
      rowMode: "array",
    }) as unknown[][];

    if (method === "get") {
      return Promise.resolve({ rows: rows[0] ?? [] });
    }

    return Promise.resolve({ rows });
  });
};

export type DrizzleDb = ReturnType<typeof createDrizzleDb>;
