import * as Comlink from "comlink";
import { APP_VERSION, migrations } from "./migrations";
import { setPerfLogging, timed } from "./perf-log";
import type {
  AssetRows,
  JunctionRow,
  ReservoirRow,
  TankRow,
  PipeRow,
  PumpRow,
  ValveRow,
} from "./mappers/assets/schema";
import type {
  CustomerPointRow,
  CustomerPointDemandRow,
  CustomerPointsData,
} from "./mappers/customer-points/schema";
import type { JunctionDemandRow } from "./mappers/junction-demands/schema";
import type { PatternRow } from "./mappers/patterns/schema";
import type { CurveRow } from "./mappers/curves/schema";
import type { AssetPatchRow } from "./mappers/assets/patches";
import type { ApplyMomentPayload } from "./commands/apply-moment";
import type { OpenDbResult } from "./commands/open-project";
import { formatErrorDetails } from "src/lib/errors";

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

const readAll = async (sql: string): Promise<unknown[]> => {
  await ready;
  if (!db) throw new Error("No database open");
  return db.exec(sql, {
    returnValue: "resultRows",
    rowMode: "object",
  }) as unknown[];
};

const ASSET_TYPE_TABLES = [
  "junctions",
  "reservoirs",
  "tanks",
  "pipes",
  "pumps",
  "valves",
] as const;

const insertPattern = (row: PatternRow) => {
  getStmt(
    `INSERT INTO patterns (id, label, type, multipliers) VALUES (?, ?, ?, ?)`,
  )
    .bind([row.id, row.label, row.type, row.multipliers])
    .stepReset();
};

const insertCurve = (row: CurveRow) => {
  getStmt(`INSERT INTO curves (id, label, type, points) VALUES (?, ?, ?, ?)`)
    .bind([row.id, row.label, row.type, row.points])
    .stepReset();
};

const upsertControls = (data: string) => {
  db!.exec(`INSERT OR REPLACE INTO controls (id, data) VALUES (1, ?)`, {
    bind: [data],
  });
};

const upsertSimulationSettings = (data: string) => {
  db!.exec(
    `INSERT OR REPLACE INTO simulation_settings (id, data) VALUES (1, ?)`,
    {
      bind: [data],
    },
  );
};

/*
 * SQLite caps total bound parameters per statement at SQLITE_MAX_VARIABLE_NUMBER
 * (32766 in modern builds). A bulk INSERT binds `chunkSize × columnCount`
 * parameters, so the usable chunk size shrinks as a table's column count grows.
 * These values target ~30000 params per statement (~92% of the cap, ~8%
 * headroom) — pushing junctions and pipes (the abundant tables) as close to the
 * ceiling as their column counts allow, and scaling down for wider tables.
 */
const BULK_TABLES = [
  ...ASSET_TYPE_TABLES,
  "customer_points",
  "customer_point_demands",
  "junction_demands",
] as const;

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
} as const satisfies Record<(typeof BULK_TABLES)[number], number>;

const buildBulkInsertSql = (
  table: string,
  columns: readonly string[],
  rowCount: number,
): string => {
  const placeholder = `(${columns.map(() => "?").join(",")})`;
  const values = new Array<string>(rowCount).fill(placeholder).join(",");
  return `INSERT INTO ${table} (${columns.join(",")}) VALUES ${values}`;
};

const bulkInsert = <T>(
  table: string,
  columns: readonly string[],
  rows: readonly T[],
  appendParams: (row: T, params: unknown[]) => void,
  chunkSize: number,
): void => {
  if (rows.length === 0) return;
  const fullChunks = Math.floor(rows.length / chunkSize);
  const remainder = rows.length % chunkSize;

  if (fullChunks > 0) {
    const sql = buildBulkInsertSql(table, columns, chunkSize);
    for (let c = 0; c < fullChunks; c++) {
      const params: unknown[] = [];
      const base = c * chunkSize;
      for (let i = 0; i < chunkSize; i++) {
        appendParams(rows[base + i], params);
      }
      getStmt(sql).bind(params).stepReset();
    }
  }

  if (remainder > 0) {
    const sql = buildBulkInsertSql(table, columns, remainder);
    const params: unknown[] = [];
    const base = fullChunks * chunkSize;
    for (let i = 0; i < remainder; i++) {
      appendParams(rows[base + i], params);
    }
    getStmt(sql).bind(params).stepReset();
  }
};

const BULK_DELETE_CHUNK_SIZE = 10000;

const bulkDelete = (
  tables: readonly string[],
  column: string,
  ids: readonly number[],
): void => {
  if (ids.length === 0) return;
  const fullChunks = Math.floor(ids.length / BULK_DELETE_CHUNK_SIZE);
  const remainder = ids.length % BULK_DELETE_CHUNK_SIZE;
  const fullPlaceholders = new Array<string>(BULK_DELETE_CHUNK_SIZE)
    .fill("?")
    .join(",");
  const tailPlaceholders =
    remainder > 0 ? new Array<string>(remainder).fill("?").join(",") : "";

  for (const table of tables) {
    if (fullChunks > 0) {
      const sql = `DELETE FROM ${table} WHERE ${column} IN (${fullPlaceholders})`;
      for (let c = 0; c < fullChunks; c++) {
        const base = c * BULK_DELETE_CHUNK_SIZE;
        const params = ids.slice(base, base + BULK_DELETE_CHUNK_SIZE);
        getStmt(sql).bind(params).stepReset();
      }
    }
    if (remainder > 0) {
      const sql = `DELETE FROM ${table} WHERE ${column} IN (${tailPlaceholders})`;
      const base = fullChunks * BULK_DELETE_CHUNK_SIZE;
      const params = ids.slice(base, base + remainder);
      getStmt(sql).bind(params).stepReset();
    }
  }
};

/*
 * Bulk UPDATE via SQLite's `UPDATE … FROM (VALUES …)` (supported since 3.33).
 * Patches are grouped by their column set so each group uses a single
 * prepared-statement shape; rows within a group fill one VALUES row each.
 * Total params per statement = rows × (1 + columnCount); chunk size is
 * derived from the 30000-param target (matching BULK_CHUNK_SIZES headroom).
 */
const BULK_UPDATE_MAX_PARAMS = 30000;

const bulkUpdate = (table: string, rows: readonly AssetPatchRow[]): void => {
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
    applyBulkUpdateGroup(table, columns, groupRows);
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

const bulkInsertJunctions = (rows: readonly JunctionRow[]) => {
  bulkInsert(
    "junctions",
    [
      "id",
      "label",
      "is_active",
      "coord_x",
      "coord_y",
      "elevation",
      "initial_quality",
      "chemical_source_type",
      "chemical_source_strength",
      "chemical_source_pattern_id",
      "emitter_coefficient",
    ],
    rows,
    (row, params) => {
      params.push(
        row.id,
        row.label,
        row.is_active,
        row.coord_x,
        row.coord_y,
        row.elevation,
        row.initial_quality,
        row.chemical_source_type,
        row.chemical_source_strength,
        row.chemical_source_pattern_id,
        row.emitter_coefficient,
      );
    },
    BULK_CHUNK_SIZES.junctions,
  );
};

const bulkInsertReservoirs = (rows: readonly ReservoirRow[]) => {
  bulkInsert(
    "reservoirs",
    [
      "id",
      "label",
      "is_active",
      "coord_x",
      "coord_y",
      "elevation",
      "initial_quality",
      "chemical_source_type",
      "chemical_source_strength",
      "chemical_source_pattern_id",
      "head",
      "head_pattern_id",
    ],
    rows,
    (row, params) => {
      params.push(
        row.id,
        row.label,
        row.is_active,
        row.coord_x,
        row.coord_y,
        row.elevation,
        row.initial_quality,
        row.chemical_source_type,
        row.chemical_source_strength,
        row.chemical_source_pattern_id,
        row.head,
        row.head_pattern_id,
      );
    },
    BULK_CHUNK_SIZES.reservoirs,
  );
};

const bulkInsertTanks = (rows: readonly TankRow[]) => {
  bulkInsert(
    "tanks",
    [
      "id",
      "label",
      "is_active",
      "coord_x",
      "coord_y",
      "elevation",
      "initial_quality",
      "chemical_source_type",
      "chemical_source_strength",
      "chemical_source_pattern_id",
      "initial_level",
      "min_level",
      "max_level",
      "min_volume",
      "diameter",
      "overflow",
      "mixing_model",
      "mixing_fraction",
      "bulk_reaction_coeff",
      "volume_curve_id",
    ],
    rows,
    (row, params) => {
      params.push(
        row.id,
        row.label,
        row.is_active,
        row.coord_x,
        row.coord_y,
        row.elevation,
        row.initial_quality,
        row.chemical_source_type,
        row.chemical_source_strength,
        row.chemical_source_pattern_id,
        row.initial_level,
        row.min_level,
        row.max_level,
        row.min_volume,
        row.diameter,
        row.overflow,
        row.mixing_model,
        row.mixing_fraction,
        row.bulk_reaction_coeff,
        row.volume_curve_id,
      );
    },
    BULK_CHUNK_SIZES.tanks,
  );
};

const bulkInsertPipes = (rows: readonly PipeRow[]) => {
  bulkInsert(
    "pipes",
    [
      "id",
      "label",
      "is_active",
      "start_node_id",
      "end_node_id",
      "coords",
      "length",
      "initial_status",
      "diameter",
      "roughness",
      "minor_loss",
      "bulk_reaction_coeff",
      "wall_reaction_coeff",
    ],
    rows,
    (row, params) => {
      params.push(
        row.id,
        row.label,
        row.is_active,
        row.start_node_id,
        row.end_node_id,
        row.coords,
        row.length,
        row.initial_status,
        row.diameter,
        row.roughness,
        row.minor_loss,
        row.bulk_reaction_coeff,
        row.wall_reaction_coeff,
      );
    },
    BULK_CHUNK_SIZES.pipes,
  );
};

const bulkInsertPumps = (rows: readonly PumpRow[]) => {
  bulkInsert(
    "pumps",
    [
      "id",
      "label",
      "is_active",
      "start_node_id",
      "end_node_id",
      "coords",
      "length",
      "initial_status",
      "definition_type",
      "power",
      "speed",
      "speed_pattern_id",
      "efficiency_curve_id",
      "energy_price",
      "energy_price_pattern_id",
      "curve_id",
      "curve_points",
    ],
    rows,
    (row, params) => {
      params.push(
        row.id,
        row.label,
        row.is_active,
        row.start_node_id,
        row.end_node_id,
        row.coords,
        row.length,
        row.initial_status,
        row.definition_type,
        row.power,
        row.speed,
        row.speed_pattern_id,
        row.efficiency_curve_id,
        row.energy_price,
        row.energy_price_pattern_id,
        row.curve_id,
        row.curve_points,
      );
    },
    BULK_CHUNK_SIZES.pumps,
  );
};

const bulkInsertValves = (rows: readonly ValveRow[]) => {
  bulkInsert(
    "valves",
    [
      "id",
      "label",
      "is_active",
      "start_node_id",
      "end_node_id",
      "coords",
      "length",
      "initial_status",
      "diameter",
      "minor_loss",
      "valve_kind",
      "setting",
      "curve_id",
    ],
    rows,
    (row, params) => {
      params.push(
        row.id,
        row.label,
        row.is_active,
        row.start_node_id,
        row.end_node_id,
        row.coords,
        row.length,
        row.initial_status,
        row.diameter,
        row.minor_loss,
        row.valve_kind,
        row.setting,
        row.curve_id,
      );
    },
    BULK_CHUNK_SIZES.valves,
  );
};

const bulkInsertCustomerPoints = (rows: readonly CustomerPointRow[]) => {
  bulkInsert(
    "customer_points",
    [
      "id",
      "label",
      "coord_x",
      "coord_y",
      "pipe_id",
      "junction_id",
      "snap_x",
      "snap_y",
    ],
    rows,
    (row, params) => {
      params.push(
        row.id,
        row.label,
        row.coord_x,
        row.coord_y,
        row.pipe_id,
        row.junction_id,
        row.snap_x,
        row.snap_y,
      );
    },
    BULK_CHUNK_SIZES.customer_points,
  );
};

const bulkInsertCustomerPointDemands = (
  rows: readonly CustomerPointDemandRow[],
) => {
  bulkInsert(
    "customer_point_demands",
    ["customer_point_id", "ordinal", "base_demand", "pattern_id"],
    rows,
    (row, params) => {
      params.push(
        row.customer_point_id,
        row.ordinal,
        row.base_demand,
        row.pattern_id,
      );
    },
    BULK_CHUNK_SIZES.customer_point_demands,
  );
};

const bulkInsertJunctionDemands = (rows: readonly JunctionDemandRow[]) => {
  bulkInsert(
    "junction_demands",
    ["junction_id", "ordinal", "base_demand", "pattern_id"],
    rows,
    (row, params) => {
      params.push(
        row.junction_id,
        row.ordinal,
        row.base_demand,
        row.pattern_id,
      );
    },
    BULK_CHUNK_SIZES.junction_demands,
  );
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
      if (!db) throw new Error("No database open");
      const rows = db.exec("SELECT settings FROM project WHERE id = 1", {
        returnValue: "resultRows",
      }) as string[][];
      if (rows.length === 0) return null;
      return rows[0][0];
    });
  },

  async saveProjectSettings(json: string) {
    return timed("saveProjectSettings", async () => {
      await ready;
      if (!db) throw new Error("No database open");
      db.exec("INSERT OR REPLACE INTO project (id, settings) VALUES (1, ?)", {
        bind: [json],
      });
    });
  },

  async getJunctions(): Promise<unknown[]> {
    return timed("getJunctions", () => readAll("SELECT * FROM junctions"));
  },

  async getReservoirs(): Promise<unknown[]> {
    return timed("getReservoirs", () => readAll("SELECT * FROM reservoirs"));
  },

  async getTanks(): Promise<unknown[]> {
    return timed("getTanks", () => readAll("SELECT * FROM tanks"));
  },

  async getPipes(): Promise<unknown[]> {
    return timed("getPipes", () => readAll("SELECT * FROM pipes"));
  },

  async getPumps(): Promise<unknown[]> {
    return timed("getPumps", () => readAll("SELECT * FROM pumps"));
  },

  async getValves(): Promise<unknown[]> {
    return timed("getValves", () => readAll("SELECT * FROM valves"));
  },

  async getCustomerPoints(): Promise<unknown[]> {
    return timed("getCustomerPoints", () =>
      readAll("SELECT * FROM customer_points"),
    );
  },

  async getCustomerPointDemands(): Promise<unknown[]> {
    return timed("getCustomerPointDemands", () =>
      readAll(
        "SELECT * FROM customer_point_demands ORDER BY customer_point_id, ordinal",
      ),
    );
  },

  async getPatterns(): Promise<unknown[]> {
    return timed("getPatterns", () =>
      readAll("SELECT * FROM patterns ORDER BY id"),
    );
  },

  async getCurves(): Promise<unknown[]> {
    return timed("getCurves", () =>
      readAll("SELECT * FROM curves ORDER BY id"),
    );
  },

  async getControls(): Promise<string | null> {
    return timed("getControls", async () => {
      await ready;
      if (!db) throw new Error("No database open");
      const rows = db.exec("SELECT data FROM controls WHERE id = 1", {
        returnValue: "resultRows",
      }) as string[][];
      if (rows.length === 0) return null;
      return rows[0][0];
    });
  },

  async getSimulationSettings(): Promise<string | null> {
    return timed("getSimulationSettings", async () => {
      await ready;
      if (!db) throw new Error("No database open");
      const rows = db.exec(
        "SELECT data FROM simulation_settings WHERE id = 1",
        {
          returnValue: "resultRows",
        },
      ) as string[][];
      if (rows.length === 0) return null;
      return rows[0][0];
    });
  },

  async getJunctionDemands(): Promise<unknown[]> {
    return timed("getJunctionDemands", () =>
      readAll("SELECT * FROM junction_demands ORDER BY junction_id, ordinal"),
    );
  },

  async getMaxId(): Promise<number> {
    return timed("getMaxId", async () => {
      await ready;
      if (!db) throw new Error("No database open");
      const rows = db.exec(
        `SELECT MAX(m) AS m FROM (
           SELECT MAX(id) AS m FROM junctions UNION ALL
           SELECT MAX(id) FROM reservoirs UNION ALL
           SELECT MAX(id) FROM tanks UNION ALL
           SELECT MAX(id) FROM pipes UNION ALL
           SELECT MAX(id) FROM pumps UNION ALL
           SELECT MAX(id) FROM valves UNION ALL
           SELECT MAX(id) FROM customer_points UNION ALL
           SELECT MAX(id) FROM patterns UNION ALL
           SELECT MAX(id) FROM curves
         )`,
        { returnValue: "resultRows" },
      ) as Array<Array<number | null>>;
      return rows[0]?.[0] ?? 0;
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

          bulkDelete(ASSET_TYPE_TABLES, "id", touchedAssetIds);

          bulkInsertJunctions(payload.assetUpserts.junctions);
          bulkInsertReservoirs(payload.assetUpserts.reservoirs);
          bulkInsertTanks(payload.assetUpserts.tanks);
          bulkInsertPipes(payload.assetUpserts.pipes);
          bulkInsertPumps(payload.assetUpserts.pumps);
          bulkInsertValves(payload.assetUpserts.valves);

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
          bulkDelete(
            ["customer_point_demands"],
            "customer_point_id",
            cpDemandCpIds,
          );

          const cpIds: number[] = [...payload.customerPointDeleteIds];
          for (const r of payload.customerPointUpserts) cpIds.push(r.id);
          bulkDelete(["customer_points"], "id", cpIds);

          bulkInsertCustomerPoints(payload.customerPointUpserts);

          const cpDemandRows: CustomerPointDemandRow[] = [];
          for (const u of payload.customerPointDemandUpdates) {
            for (const row of u.demands) cpDemandRows.push(row);
          }
          bulkInsertCustomerPointDemands(cpDemandRows);

          const jDemandJunctionIds: number[] = [];
          for (const u of payload.junctionDemandUpdates) {
            jDemandJunctionIds.push(u.junctionId);
          }
          bulkDelete(["junction_demands"], "junction_id", jDemandJunctionIds);

          const jDemandRows: JunctionDemandRow[] = [];
          for (const u of payload.junctionDemandUpdates) {
            for (const row of u.demands) jDemandRows.push(row);
          }
          bulkInsertJunctionDemands(jDemandRows);

          if (payload.patternsReplacement !== null) {
            db.exec("DELETE FROM patterns");
            for (const row of payload.patternsReplacement) {
              insertPattern(row);
            }
          }
          if (payload.curvesReplacement !== null) {
            db.exec("DELETE FROM curves");
            for (const row of payload.curvesReplacement) {
              insertCurve(row);
            }
          }
          if (payload.controlsReplacement !== null) {
            upsertControls(payload.controlsReplacement);
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
          for (const table of ASSET_TYPE_TABLES) {
            db.exec(`DELETE FROM ${table}`);
          }

          bulkInsertJunctions(payload.junctions);
          bulkInsertReservoirs(payload.reservoirs);
          bulkInsertTanks(payload.tanks);
          bulkInsertPipes(payload.pipes);
          bulkInsertPumps(payload.pumps);
          bulkInsertValves(payload.valves);

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
          db.exec("DELETE FROM customer_point_demands");
          db.exec("DELETE FROM customer_points");

          bulkInsertCustomerPoints(payload.customerPoints);
          bulkInsertCustomerPointDemands(payload.demands);

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
          db.exec("DELETE FROM patterns");
          for (const row of rows) insertPattern(row);
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
          db.exec("DELETE FROM curves");
          for (const row of rows) insertCurve(row);
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
      if (!db) throw new Error("No database open");
      upsertControls(data);
    });
  },

  async setAllSimulationSettings(data: string): Promise<void> {
    return timed("setAllSimulationSettings", async () => {
      await ready;
      if (!db) throw new Error("No database open");
      upsertSimulationSettings(data);
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
          db.exec("DELETE FROM junction_demands");
          bulkInsertJunctionDemands(rows);
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
