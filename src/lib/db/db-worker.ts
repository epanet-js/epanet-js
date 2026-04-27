import * as Comlink from "comlink";
import { eq, inArray } from "drizzle-orm";
import { APP_VERSION, migrations } from "./migrations";
import { setPerfLogging, timed } from "./perf-log";
import type {
  AssetRows,
  CustomerPointDemandRow,
  CustomerPointsData,
  JunctionDemandRow,
  PatternRow,
  CurveRow,
} from "./rows";
import type { AssetPatchRow } from "./asset-patches";
import type { ApplyMomentPayload } from "./apply-moment";
import type { OpenDbResult } from "./open-project";
import { formatErrorDetails } from "src/lib/errors";
import { createDrizzleDb } from "./drizzle";
import {
  project,
  junctions,
  reservoirs,
  tanks,
  pipes,
  pumps,
  valves,
  customer_points,
  customer_point_demands,
  patterns,
  junction_demands,
  curves,
  controls,
  simulation_settings,
} from "./schema";
import type { SQLiteTable, SQLiteColumn } from "drizzle-orm/sqlite-core";

type Stmt = {
  bind: (values: unknown[]) => Stmt;
  step: () => boolean;
  reset: (alsoBindValues?: boolean) => Stmt;
  stepReset: () => Stmt;
  finalize: () => void;
};

type OoDb = {
  pointer?: number;
  exec: (
    sql: string,
    opts?: {
      bind?: unknown[];
      returnValue?: "this" | "resultRows" | "saveSql";
      rowMode?: "array" | "object";
    },
  ) => unknown;
  prepare: (sql: string) => Stmt;
  close: () => void;
};

type Sqlite3 = {
  oo1: { DB: new (filename?: string, flags?: string) => OoDb };
  wasm: {
    allocFromTypedArray: (bytes: Uint8Array) => number;
  };
  capi: {
    sqlite3_deserialize: (
      db: number,
      schema: string,
      data: number,
      dbSize: number,
      bufferSize: number,
      flags: number,
    ) => number;
    sqlite3_js_db_export: (db: number, schema?: string) => Uint8Array;
    SQLITE_DESERIALIZE_FREEONCLOSE: number;
    SQLITE_DESERIALIZE_RESIZEABLE: number;
  };
};

let sqlite3: Sqlite3 | null = null;
let db: OoDb | null = null;
const stmtCache = new Map<string, Stmt>();

const ready = (async () => {
  const mod = await import("@sqlite.org/sqlite-wasm");
  sqlite3 = (await mod.default()) as unknown as Sqlite3;
})();

const getStmt = (sql: string): Stmt => {
  let stmt = stmtCache.get(sql);
  if (!stmt) {
    stmt = db!.prepare(sql);
    stmtCache.set(sql, stmt);
  }
  return stmt;
};

const drizzleDb = createDrizzleDb(() => {
  if (!db) throw new Error("No database open");
  return db;
}, getStmt);

const finalizeStmts = () => {
  for (const stmt of stmtCache.values()) {
    try {
      stmt.finalize();
    } catch {
      // ignore
    }
  }
  stmtCache.clear();
};

const closeExistingDb = () => {
  if (db) {
    finalizeStmts();
    try {
      db.close();
    } catch {
      // ignore
    }
    db = null;
  }
};

const readUserVersion = (): number => {
  const rows = db!.exec("PRAGMA user_version", {
    returnValue: "resultRows",
  }) as number[][];
  return rows[0][0];
};

const runMigrations = () => {
  const current = readUserVersion();
  if (current >= migrations.length) return;

  db!.exec("BEGIN IMMEDIATE");
  try {
    for (let i = current; i < migrations.length; i++) {
      db!.exec(migrations[i]);
    }
    db!.exec(`PRAGMA user_version = ${migrations.length}`);
    db!.exec("COMMIT");
  } catch (e) {
    db!.exec("ROLLBACK");
    throw e;
  }
};

const ASSET_TYPE_TABLES = [
  junctions,
  reservoirs,
  tanks,
  pipes,
  pumps,
  valves,
] as const;

const insertPattern = async (row: PatternRow) => {
  await drizzleDb.insert(patterns).values(row);
};

const insertCurve = async (row: CurveRow) => {
  await drizzleDb.insert(curves).values(row);
};

const upsertControls = async (data: string) => {
  await drizzleDb
    .insert(controls)
    .values({ id: 1, data })
    .onConflictDoUpdate({ target: controls.id, set: { data } });
};

const upsertSimulationSettings = async (data: string) => {
  await drizzleDb
    .insert(simulation_settings)
    .values({ id: 1, data })
    .onConflictDoUpdate({ target: simulation_settings.id, set: { data } });
};

/*
 * SQLite caps total bound parameters per statement at SQLITE_MAX_VARIABLE_NUMBER
 * (32766). Drizzle does not auto-chunk; chunk sizes here target ~30000 params per
 * statement (~92% of cap, ~8% headroom) — junctions/pipes pushed near the ceiling,
 * scaled down for wider tables.
 */
const BULK_CHUNK_SIZES = {
  junctions: 2700, // 11 cols × 2700 = 29700 params
  reservoirs: 2500, // 12 cols × 2500 = 30000 params
  tanks: 1500, // 20 cols × 1500 = 30000 params
  pipes: 2300, // 13 cols × 2300 = 29900 params
  pumps: 1700, // 17 cols × 1700 = 28900 params
  valves: 2300, // 13 cols × 2300 = 29900 params
  customer_points: 3700, //  8 cols × 3700 = 29600 params
  customer_point_demands: 7500, //  4 cols × 7500 = 30000 params
  junction_demands: 7500, //  4 cols × 7500 = 30000 params
} as const;

const insertChunked = async <T extends SQLiteTable>(
  table: T,
  rows: readonly Record<string, unknown>[],
  chunkSize: number,
): Promise<void> => {
  if (rows.length === 0) return;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    await drizzleDb.insert(table).values(chunk as never);
  }
};

const BULK_DELETE_CHUNK_SIZE = 10000;

const deleteByIdsChunked = async (
  table: SQLiteTable,
  column: SQLiteColumn,
  ids: readonly number[],
): Promise<void> => {
  if (ids.length === 0) return;
  for (let i = 0; i < ids.length; i += BULK_DELETE_CHUNK_SIZE) {
    const chunk = ids.slice(i, i + BULK_DELETE_CHUNK_SIZE);
    await drizzleDb.delete(table).where(inArray(column, chunk));
  }
};

/*
 * Bulk UPDATE via SQLite's `UPDATE … FROM (VALUES …)` (supported since 3.33).
 * Drizzle has no first-class equivalent, so this stays raw. Patches are grouped
 * by their column set so each group uses a single prepared-statement shape;
 * rows within a group fill one VALUES row each. Total params per statement =
 * rows × (1 + columnCount); chunk size derived from the 30000-param target.
 */
const BULK_UPDATE_MAX_PARAMS = 30000;

const bulkUpdate = (
  tableName: string,
  rows: readonly AssetPatchRow[],
): void => {
  if (rows.length === 0) return;

  const groups = new Map<
    string,
    { columns: string[]; rows: AssetPatchRow[] }
  >();
  for (const row of rows) {
    const cols: string[] = [];
    for (const key in row) {
      if (key !== "id") cols.push(key);
    }
    if (cols.length === 0) continue;
    cols.sort();
    const groupKey = cols.join(",");
    let group = groups.get(groupKey);
    if (!group) {
      group = { columns: cols, rows: [] };
      groups.set(groupKey, group);
    }
    group.rows.push(row);
  }

  for (const { columns, rows: groupRows } of groups.values()) {
    applyBulkUpdateGroup(tableName, columns, groupRows);
  }
};

const applyBulkUpdateGroup = (
  table: string,
  columns: readonly string[],
  rows: readonly AssetPatchRow[],
): void => {
  const paramsPerRow = 1 + columns.length;
  const chunkSize = Math.max(
    1,
    Math.floor(BULK_UPDATE_MAX_PARAMS / paramsPerRow),
  );
  const fullChunks = Math.floor(rows.length / chunkSize);
  const remainder = rows.length % chunkSize;

  if (fullChunks > 0) {
    const sql = buildBulkUpdateSql(table, columns, chunkSize);
    for (let c = 0; c < fullChunks; c++) {
      const params: unknown[] = [];
      const base = c * chunkSize;
      for (let i = 0; i < chunkSize; i++) {
        appendUpdateParams(rows[base + i], columns, params);
      }
      getStmt(sql).bind(params).stepReset();
    }
  }

  if (remainder > 0) {
    const sql = buildBulkUpdateSql(table, columns, remainder);
    const params: unknown[] = [];
    const base = fullChunks * chunkSize;
    for (let i = 0; i < remainder; i++) {
      appendUpdateParams(rows[base + i], columns, params);
    }
    getStmt(sql).bind(params).stepReset();
  }
};

const buildBulkUpdateSql = (
  table: string,
  columns: readonly string[],
  rowCount: number,
): string => {
  const rowPh = `(${new Array<string>(1 + columns.length).fill("?").join(",")})`;
  const values = new Array<string>(rowCount).fill(rowPh).join(",");
  const cteCols = ["id", ...columns].join(",");
  const setClause = columns.map((c) => `${c} = _p.${c}`).join(",");
  return `WITH _p(${cteCols}) AS (VALUES ${values}) UPDATE ${table} SET ${setClause} FROM _p WHERE ${table}.id = _p.id`;
};

const appendUpdateParams = (
  row: AssetPatchRow,
  columns: readonly string[],
  params: unknown[],
): void => {
  params.push(row.id);
  for (const col of columns) {
    params.push(row[col]);
  }
};

const countApplyMoment = (payload: ApplyMomentPayload) => ({
  delAssets: payload.assetDeleteIds.length,
  upJ: payload.assetUpserts.junctions.length,
  upR: payload.assetUpserts.reservoirs.length,
  upT: payload.assetUpserts.tanks.length,
  upP: payload.assetUpserts.pipes.length,
  upPu: payload.assetUpserts.pumps.length,
  upV: payload.assetUpserts.valves.length,
  patJ: payload.assetPatches.junctions.length,
  patR: payload.assetPatches.reservoirs.length,
  patT: payload.assetPatches.tanks.length,
  patP: payload.assetPatches.pipes.length,
  patPu: payload.assetPatches.pumps.length,
  patV: payload.assetPatches.valves.length,
  delCp: payload.customerPointDeleteIds.length,
  upCp: payload.customerPointUpserts.length,
  cpDem: payload.customerPointDemandUpdates.length,
  jDem: payload.junctionDemandUpdates.length,
  pat: payload.patternsReplacement?.length ?? 0,
  cur: payload.curvesReplacement?.length ?? 0,
  ctrl: payload.controlsReplacement !== null ? 1 : 0,
});

const api = {
  setPerfLogging(enabled: boolean) {
    setPerfLogging(enabled, "db [worker]");
  },

  async newDb() {
    return timed("newDb", async () => {
      await ready;
      closeExistingDb();
      db = new sqlite3!.oo1.DB(":memory:", "c");
      runMigrations();
      db.exec(`PRAGMA application_id = ${APP_VERSION}`);
    });
  },

  async openDb(fileBytes: Uint8Array): Promise<OpenDbResult> {
    return timed(
      "openDb",
      async () => {
        await ready;
        closeExistingDb();

        try {
          db = new sqlite3!.oo1.DB(":memory:", "c");
          const p = sqlite3!.wasm.allocFromTypedArray(fileBytes);
          const flags =
            sqlite3!.capi.SQLITE_DESERIALIZE_FREEONCLOSE |
            sqlite3!.capi.SQLITE_DESERIALIZE_RESIZEABLE;
          sqlite3!.capi.sqlite3_deserialize(
            db.pointer!,
            "main",
            p,
            fileBytes.length,
            fileBytes.length,
            flags,
          );

          let fileVersion: number;
          try {
            fileVersion = readUserVersion();
          } catch (e) {
            closeExistingDb();
            return { status: "corrupt", errorDetails: formatErrorDetails(e) };
          }

          if (fileVersion > migrations.length) {
            closeExistingDb();
            return { status: "too-new", fileVersion, appVersion: APP_VERSION };
          }
          if (fileVersion < migrations.length) {
            try {
              runMigrations();
            } catch (e) {
              closeExistingDb();
              return {
                status: "migration-failed",
                errorDetails: formatErrorDetails(e),
                fileVersion,
                appVersion: APP_VERSION,
              };
            }
            return { status: "migrated", fileVersion, appVersion: APP_VERSION };
          }
          return { status: "ok", fileVersion, appVersion: APP_VERSION };
        } catch (e) {
          closeExistingDb();
          return { status: "internal", errorDetails: formatErrorDetails(e) };
        }
      },
      { bytes: fileBytes.length },
    );
  },

  async getProjectSettings(): Promise<string | null> {
    return timed("getProjectSettings", async () => {
      await ready;
      const rows = await drizzleDb
        .select({ settings: project.settings })
        .from(project)
        .where(eq(project.id, 1));
      return rows.length === 0 ? null : rows[0].settings;
    });
  },

  async saveProjectSettings(json: string) {
    return timed("saveProjectSettings", async () => {
      await ready;
      await drizzleDb
        .insert(project)
        .values({ id: 1, settings: json })
        .onConflictDoUpdate({ target: project.id, set: { settings: json } });
    });
  },

  async getJunctions(): Promise<unknown[]> {
    return timed("getJunctions", async () => {
      await ready;
      return drizzleDb.select().from(junctions);
    });
  },

  async getReservoirs(): Promise<unknown[]> {
    return timed("getReservoirs", async () => {
      await ready;
      return drizzleDb.select().from(reservoirs);
    });
  },

  async getTanks(): Promise<unknown[]> {
    return timed("getTanks", async () => {
      await ready;
      return drizzleDb.select().from(tanks);
    });
  },

  async getPipes(): Promise<unknown[]> {
    return timed("getPipes", async () => {
      await ready;
      return drizzleDb.select().from(pipes);
    });
  },

  async getPumps(): Promise<unknown[]> {
    return timed("getPumps", async () => {
      await ready;
      return drizzleDb.select().from(pumps);
    });
  },

  async getValves(): Promise<unknown[]> {
    return timed("getValves", async () => {
      await ready;
      return drizzleDb.select().from(valves);
    });
  },

  async getCustomerPoints(): Promise<unknown[]> {
    return timed("getCustomerPoints", async () => {
      await ready;
      return drizzleDb.select().from(customer_points);
    });
  },

  async getCustomerPointDemands(): Promise<unknown[]> {
    return timed("getCustomerPointDemands", async () => {
      await ready;
      return drizzleDb
        .select()
        .from(customer_point_demands)
        .orderBy(
          customer_point_demands.customer_point_id,
          customer_point_demands.ordinal,
        );
    });
  },

  async getPatterns(): Promise<unknown[]> {
    return timed("getPatterns", async () => {
      await ready;
      return drizzleDb.select().from(patterns).orderBy(patterns.id);
    });
  },

  async getCurves(): Promise<unknown[]> {
    return timed("getCurves", async () => {
      await ready;
      return drizzleDb.select().from(curves).orderBy(curves.id);
    });
  },

  async getControls(): Promise<string | null> {
    return timed("getControls", async () => {
      await ready;
      const rows = await drizzleDb
        .select({ data: controls.data })
        .from(controls)
        .where(eq(controls.id, 1));
      return rows.length === 0 ? null : rows[0].data;
    });
  },

  async getSimulationSettings(): Promise<string | null> {
    return timed("getSimulationSettings", async () => {
      await ready;
      const rows = await drizzleDb
        .select({ data: simulation_settings.data })
        .from(simulation_settings)
        .where(eq(simulation_settings.id, 1));
      return rows.length === 0 ? null : rows[0].data;
    });
  },

  async getJunctionDemands(): Promise<unknown[]> {
    return timed("getJunctionDemands", async () => {
      await ready;
      return drizzleDb
        .select()
        .from(junction_demands)
        .orderBy(junction_demands.junction_id, junction_demands.ordinal);
    });
  },

  async applyMoment(payload: ApplyMomentPayload): Promise<void> {
    return timed(
      "applyMoment",
      async () => {
        await ready;
        if (!db) throw new Error("No database open");
        db.exec("BEGIN IMMEDIATE");
        try {
          const touchedAssetIds: number[] = [...payload.assetDeleteIds];
          for (const r of payload.assetUpserts.junctions)
            touchedAssetIds.push(r.id);
          for (const r of payload.assetUpserts.reservoirs)
            touchedAssetIds.push(r.id);
          for (const r of payload.assetUpserts.tanks)
            touchedAssetIds.push(r.id);
          for (const r of payload.assetUpserts.pipes)
            touchedAssetIds.push(r.id);
          for (const r of payload.assetUpserts.pumps)
            touchedAssetIds.push(r.id);
          for (const r of payload.assetUpserts.valves)
            touchedAssetIds.push(r.id);

          for (const t of ASSET_TYPE_TABLES) {
            await deleteByIdsChunked(t, t.id, touchedAssetIds);
          }

          await insertChunked(
            junctions,
            payload.assetUpserts.junctions,
            BULK_CHUNK_SIZES.junctions,
          );
          await insertChunked(
            reservoirs,
            payload.assetUpserts.reservoirs,
            BULK_CHUNK_SIZES.reservoirs,
          );
          await insertChunked(
            tanks,
            payload.assetUpserts.tanks,
            BULK_CHUNK_SIZES.tanks,
          );
          await insertChunked(
            pipes,
            payload.assetUpserts.pipes,
            BULK_CHUNK_SIZES.pipes,
          );
          await insertChunked(
            pumps,
            payload.assetUpserts.pumps,
            BULK_CHUNK_SIZES.pumps,
          );
          await insertChunked(
            valves,
            payload.assetUpserts.valves,
            BULK_CHUNK_SIZES.valves,
          );

          bulkUpdate("junctions", payload.assetPatches.junctions);
          bulkUpdate("reservoirs", payload.assetPatches.reservoirs);
          bulkUpdate("tanks", payload.assetPatches.tanks);
          bulkUpdate("pipes", payload.assetPatches.pipes);
          bulkUpdate("pumps", payload.assetPatches.pumps);
          bulkUpdate("valves", payload.assetPatches.valves);

          const cpDemandCpIds: number[] = [...payload.customerPointDeleteIds];
          for (const u of payload.customerPointDemandUpdates) {
            cpDemandCpIds.push(u.customerPointId);
          }
          await deleteByIdsChunked(
            customer_point_demands,
            customer_point_demands.customer_point_id,
            cpDemandCpIds,
          );

          const cpIds: number[] = [...payload.customerPointDeleteIds];
          for (const r of payload.customerPointUpserts) cpIds.push(r.id);
          await deleteByIdsChunked(customer_points, customer_points.id, cpIds);

          await insertChunked(
            customer_points,
            payload.customerPointUpserts,
            BULK_CHUNK_SIZES.customer_points,
          );

          const cpDemandRows: CustomerPointDemandRow[] = [];
          for (const u of payload.customerPointDemandUpdates) {
            for (const row of u.demands) cpDemandRows.push(row);
          }
          await insertChunked(
            customer_point_demands,
            cpDemandRows,
            BULK_CHUNK_SIZES.customer_point_demands,
          );

          const jDemandJunctionIds: number[] = [];
          for (const u of payload.junctionDemandUpdates) {
            jDemandJunctionIds.push(u.junctionId);
          }
          await deleteByIdsChunked(
            junction_demands,
            junction_demands.junction_id,
            jDemandJunctionIds,
          );

          const jDemandRows: JunctionDemandRow[] = [];
          for (const u of payload.junctionDemandUpdates) {
            for (const row of u.demands) jDemandRows.push(row);
          }
          await insertChunked(
            junction_demands,
            jDemandRows,
            BULK_CHUNK_SIZES.junction_demands,
          );

          if (payload.patternsReplacement !== null) {
            await drizzleDb.delete(patterns);
            for (const row of payload.patternsReplacement) {
              await insertPattern(row);
            }
          }
          if (payload.curvesReplacement !== null) {
            await drizzleDb.delete(curves);
            for (const row of payload.curvesReplacement) {
              await insertCurve(row);
            }
          }
          if (payload.controlsReplacement !== null) {
            await upsertControls(payload.controlsReplacement);
          }
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
      countApplyMoment(payload),
    );
  },

  async setAllAssets(payload: AssetRows): Promise<void> {
    return timed(
      "setAllAssets",
      async () => {
        await ready;
        if (!db) throw new Error("No database open");
        db.exec("BEGIN IMMEDIATE");
        try {
          for (const t of ASSET_TYPE_TABLES) {
            await drizzleDb.delete(t);
          }

          await insertChunked(
            junctions,
            payload.junctions,
            BULK_CHUNK_SIZES.junctions,
          );
          await insertChunked(
            reservoirs,
            payload.reservoirs,
            BULK_CHUNK_SIZES.reservoirs,
          );
          await insertChunked(tanks, payload.tanks, BULK_CHUNK_SIZES.tanks);
          await insertChunked(pipes, payload.pipes, BULK_CHUNK_SIZES.pipes);
          await insertChunked(pumps, payload.pumps, BULK_CHUNK_SIZES.pumps);
          await insertChunked(valves, payload.valves, BULK_CHUNK_SIZES.valves);

          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
      {
        j: payload.junctions.length,
        r: payload.reservoirs.length,
        t: payload.tanks.length,
        p: payload.pipes.length,
        pu: payload.pumps.length,
        v: payload.valves.length,
      },
    );
  },

  async setAllCustomerPoints(payload: CustomerPointsData): Promise<void> {
    return timed(
      "setAllCustomerPoints",
      async () => {
        await ready;
        if (!db) throw new Error("No database open");
        db.exec("BEGIN IMMEDIATE");
        try {
          await drizzleDb.delete(customer_point_demands);
          await drizzleDb.delete(customer_points);

          await insertChunked(
            customer_points,
            payload.customerPoints,
            BULK_CHUNK_SIZES.customer_points,
          );
          await insertChunked(
            customer_point_demands,
            payload.demands,
            BULK_CHUNK_SIZES.customer_point_demands,
          );

          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
      {
        cp: payload.customerPoints.length,
        dem: payload.demands.length,
      },
    );
  },

  async setAllPatterns(rows: PatternRow[]): Promise<void> {
    return timed(
      "setAllPatterns",
      async () => {
        await ready;
        if (!db) throw new Error("No database open");
        db.exec("BEGIN IMMEDIATE");
        try {
          await drizzleDb.delete(patterns);
          for (const row of rows) await insertPattern(row);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
      { rows: rows.length },
    );
  },

  async setAllCurves(rows: CurveRow[]): Promise<void> {
    return timed(
      "setAllCurves",
      async () => {
        await ready;
        if (!db) throw new Error("No database open");
        db.exec("BEGIN IMMEDIATE");
        try {
          await drizzleDb.delete(curves);
          for (const row of rows) await insertCurve(row);
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
      { rows: rows.length },
    );
  },

  async setAllControls(data: string): Promise<void> {
    return timed("setAllControls", async () => {
      await ready;
      await upsertControls(data);
    });
  },

  async setAllSimulationSettings(data: string): Promise<void> {
    return timed("setAllSimulationSettings", async () => {
      await ready;
      await upsertSimulationSettings(data);
    });
  },

  async setAllJunctionDemands(rows: JunctionDemandRow[]): Promise<void> {
    return timed(
      "setAllJunctionDemands",
      async () => {
        await ready;
        if (!db) throw new Error("No database open");
        db.exec("BEGIN IMMEDIATE");
        try {
          await drizzleDb.delete(junction_demands);
          await insertChunked(
            junction_demands,
            rows,
            BULK_CHUNK_SIZES.junction_demands,
          );
          db.exec("COMMIT");
        } catch (e) {
          db.exec("ROLLBACK");
          throw e;
        }
      },
      { rows: rows.length },
    );
  },

  async exportDb(): Promise<Uint8Array> {
    return timed("exportDb", async () => {
      await ready;
      if (!db) throw new Error("No database open");
      db.exec(`PRAGMA application_id = ${APP_VERSION}`);
      return sqlite3!.capi.sqlite3_js_db_export(db.pointer!);
    });
  },

  async closeDb() {
    return timed("closeDb", async () => {
      await ready;
      closeExistingDb();
    });
  },
};

export type DbWorkerApi = typeof api;

Comlink.expose(api);
