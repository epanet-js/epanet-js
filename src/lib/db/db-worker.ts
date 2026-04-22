import * as Comlink from "comlink";
import { APP_VERSION, migrations } from "./migrations";
import type {
  AssetRows,
  JunctionRow,
  ReservoirRow,
  TankRow,
  PipeRow,
  PumpRow,
  ValveRow,
  CustomerPointRow,
  CustomerPointDemandRow,
  CustomerPointsData,
  JunctionDemandRow,
  PatternRow,
  CurveRow,
} from "./rows";
import type { ApplyMomentPayload } from "./apply-moment";

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

const ready = (async () => {
  const mod = await import("@sqlite.org/sqlite-wasm");
  sqlite3 = (await mod.default()) as unknown as Sqlite3;
})();

const closeExistingDb = () => {
  if (db) {
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

const insertAsset = (row: {
  id: number;
  type: string;
  label: string | null;
  is_active: number;
}) => {
  db!.exec(
    "INSERT INTO assets (id, type, label, is_active) VALUES (?, ?, ?, ?)",
    { bind: [row.id, row.type, row.label, row.is_active] },
  );
};

const insertNodeProperties = (row: {
  id: number;
  coord_x: number;
  coord_y: number;
  elevation: number | null;
  initial_quality: number | null;
  chemical_source_type: string | null;
  chemical_source_strength: number | null;
  chemical_source_pattern_id: number | null;
}) => {
  db!.exec(
    `INSERT INTO node_properties
     (asset_id, coord_x, coord_y, elevation, initial_quality,
      chemical_source_type, chemical_source_strength, chemical_source_pattern_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      bind: [
        row.id,
        row.coord_x,
        row.coord_y,
        row.elevation,
        row.initial_quality,
        row.chemical_source_type,
        row.chemical_source_strength,
        row.chemical_source_pattern_id,
      ],
    },
  );
};

const insertLinkProperties = (row: {
  id: number;
  start_node_id: number;
  end_node_id: number;
  coords: string;
  length: number | null;
  initial_status: string | null;
}) => {
  db!.exec(
    `INSERT INTO link_properties
     (asset_id, start_node_id, end_node_id, coords, length, initial_status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    {
      bind: [
        row.id,
        row.start_node_id,
        row.end_node_id,
        row.coords,
        row.length,
        row.initial_status,
      ],
    },
  );
};

const insertJunction = (row: JunctionRow) => {
  insertAsset(row);
  insertNodeProperties(row);
  db!.exec(
    "INSERT INTO junction_properties (asset_id, emitter_coefficient) VALUES (?, ?)",
    { bind: [row.id, row.emitter_coefficient] },
  );
};

const insertReservoir = (row: ReservoirRow) => {
  insertAsset(row);
  insertNodeProperties(row);
  db!.exec(
    "INSERT INTO reservoir_properties (asset_id, head, head_pattern_id) VALUES (?, ?, ?)",
    { bind: [row.id, row.head, row.head_pattern_id] },
  );
};

const insertTank = (row: TankRow) => {
  insertAsset(row);
  insertNodeProperties(row);
  db!.exec(
    `INSERT INTO tank_properties
     (asset_id, initial_level, min_level, max_level, min_volume, diameter,
      overflow, mixing_model, mixing_fraction, bulk_reaction_coeff, volume_curve_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      bind: [
        row.id,
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
      ],
    },
  );
};

const insertPipe = (row: PipeRow) => {
  insertAsset(row);
  insertLinkProperties(row);
  db!.exec(
    `INSERT INTO pipe_properties
     (asset_id, diameter, roughness, minor_loss, bulk_reaction_coeff, wall_reaction_coeff)
     VALUES (?, ?, ?, ?, ?, ?)`,
    {
      bind: [
        row.id,
        row.diameter,
        row.roughness,
        row.minor_loss,
        row.bulk_reaction_coeff,
        row.wall_reaction_coeff,
      ],
    },
  );
};

const insertPump = (row: PumpRow) => {
  insertAsset(row);
  insertLinkProperties(row);
  db!.exec(
    `INSERT INTO pump_properties
     (asset_id, definition_type, power, speed, speed_pattern_id,
      efficiency_curve_id, energy_price, energy_price_pattern_id, curve_id,
      curve_points)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      bind: [
        row.id,
        row.definition_type,
        row.power,
        row.speed,
        row.speed_pattern_id,
        row.efficiency_curve_id,
        row.energy_price,
        row.energy_price_pattern_id,
        row.curve_id,
        row.curve_points,
      ],
    },
  );
};

const deleteAssetCascade = (id: number) => {
  for (const table of [
    "junction_properties",
    "reservoir_properties",
    "tank_properties",
    "pipe_properties",
    "pump_properties",
    "valve_properties",
    "link_properties",
    "node_properties",
  ]) {
    db!.exec(`DELETE FROM ${table} WHERE asset_id = ?`, { bind: [id] });
  }
  db!.exec("DELETE FROM assets WHERE id = ?", { bind: [id] });
};

const insertCustomerPoint = (row: CustomerPointRow) => {
  db!.exec(
    `INSERT INTO customer_points
     (id, label, coord_x, coord_y, pipe_id, junction_id, snap_x, snap_y)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    {
      bind: [
        row.id,
        row.label,
        row.coord_x,
        row.coord_y,
        row.pipe_id,
        row.junction_id,
        row.snap_x,
        row.snap_y,
      ],
    },
  );
};

const insertCustomerPointDemand = (row: CustomerPointDemandRow) => {
  db!.exec(
    `INSERT INTO customer_point_demands
     (customer_point_id, ordinal, base_demand, pattern_id)
     VALUES (?, ?, ?, ?)`,
    {
      bind: [
        row.customer_point_id,
        row.ordinal,
        row.base_demand,
        row.pattern_id,
      ],
    },
  );
};

const deleteCustomerPointDemands = (id: number) => {
  db!.exec("DELETE FROM customer_point_demands WHERE customer_point_id = ?", {
    bind: [id],
  });
};

const deleteCustomerPoint = (id: number) => {
  db!.exec("DELETE FROM customer_points WHERE id = ?", { bind: [id] });
};

const deleteCustomerPointCascade = (id: number) => {
  deleteCustomerPointDemands(id);
  deleteCustomerPoint(id);
};

const insertJunctionDemand = (row: JunctionDemandRow) => {
  db!.exec(
    `INSERT INTO junction_demands
     (junction_id, ordinal, base_demand, pattern_id)
     VALUES (?, ?, ?, ?)`,
    {
      bind: [row.junction_id, row.ordinal, row.base_demand, row.pattern_id],
    },
  );
};

const deleteJunctionDemands = (id: number) => {
  db!.exec("DELETE FROM junction_demands WHERE junction_id = ?", {
    bind: [id],
  });
};

const insertPattern = (row: PatternRow) => {
  db!.exec(
    `INSERT INTO patterns (id, label, type, multipliers) VALUES (?, ?, ?, ?)`,
    {
      bind: [row.id, row.label, row.type, row.multipliers],
    },
  );
};

const insertCurve = (row: CurveRow) => {
  db!.exec(`INSERT INTO curves (id, label, type, points) VALUES (?, ?, ?, ?)`, {
    bind: [row.id, row.label, row.type, row.points],
  });
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

const insertValve = (row: ValveRow) => {
  insertAsset(row);
  insertLinkProperties(row);
  db!.exec(
    `INSERT INTO valve_properties
     (asset_id, diameter, minor_loss, valve_kind, setting, curve_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    {
      bind: [
        row.id,
        row.diameter,
        row.minor_loss,
        row.valve_kind,
        row.setting,
        row.curve_id,
      ],
    },
  );
};

const api = {
  async newDb() {
    await ready;
    closeExistingDb();
    db = new sqlite3!.oo1.DB(":memory:", "c");
    runMigrations();
    db.exec(`PRAGMA application_id = ${APP_VERSION}`);
  },

  async openDb(fileBytes: Uint8Array): Promise<{
    status: "ok" | "migrated" | "too-new";
    fileVersion: number;
    appVersion: number;
  }> {
    await ready;
    closeExistingDb();

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

    const fileVersion = readUserVersion();
    if (fileVersion > migrations.length) {
      db.close();
      db = null;
      return { status: "too-new", fileVersion, appVersion: APP_VERSION };
    }
    if (fileVersion < migrations.length) {
      runMigrations();
      return { status: "migrated", fileVersion, appVersion: APP_VERSION };
    }
    return { status: "ok", fileVersion, appVersion: APP_VERSION };
  },

  async getProjectSettings(): Promise<string | null> {
    await ready;
    if (!db) throw new Error("No database open");
    const rows = db.exec("SELECT settings FROM project WHERE id = 1", {
      returnValue: "resultRows",
    }) as string[][];
    if (rows.length === 0) return null;
    return rows[0][0];
  },

  async saveProjectSettings(json: string) {
    await ready;
    if (!db) throw new Error("No database open");
    db.exec("INSERT OR REPLACE INTO project (id, settings) VALUES (1, ?)", {
      bind: [json],
    });
  },

  async getJunctions(): Promise<unknown[]> {
    return readAll("SELECT * FROM junctions_view");
  },

  async getReservoirs(): Promise<unknown[]> {
    return readAll("SELECT * FROM reservoirs_view");
  },

  async getTanks(): Promise<unknown[]> {
    return readAll("SELECT * FROM tanks_view");
  },

  async getPipes(): Promise<unknown[]> {
    return readAll("SELECT * FROM pipes_view");
  },

  async getPumps(): Promise<unknown[]> {
    return readAll("SELECT * FROM pumps_view");
  },

  async getValves(): Promise<unknown[]> {
    return readAll("SELECT * FROM valves_view");
  },

  async getCustomerPoints(): Promise<unknown[]> {
    return readAll("SELECT * FROM customer_points");
  },

  async getCustomerPointDemands(): Promise<unknown[]> {
    return readAll(
      "SELECT * FROM customer_point_demands ORDER BY customer_point_id, ordinal",
    );
  },

  async getPatterns(): Promise<unknown[]> {
    return readAll("SELECT * FROM patterns ORDER BY id");
  },

  async getCurves(): Promise<unknown[]> {
    return readAll("SELECT * FROM curves ORDER BY id");
  },

  async getControls(): Promise<string | null> {
    await ready;
    if (!db) throw new Error("No database open");
    const rows = db.exec("SELECT data FROM controls WHERE id = 1", {
      returnValue: "resultRows",
    }) as string[][];
    if (rows.length === 0) return null;
    return rows[0][0];
  },

  async getSimulationSettings(): Promise<string | null> {
    await ready;
    if (!db) throw new Error("No database open");
    const rows = db.exec("SELECT data FROM simulation_settings WHERE id = 1", {
      returnValue: "resultRows",
    }) as string[][];
    if (rows.length === 0) return null;
    return rows[0][0];
  },

  async getJunctionDemands(): Promise<unknown[]> {
    return readAll(
      "SELECT * FROM junction_demands ORDER BY junction_id, ordinal",
    );
  },

  async applyMoment(payload: ApplyMomentPayload): Promise<void> {
    await ready;
    if (!db) throw new Error("No database open");
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const id of payload.assetDeleteIds) {
        deleteAssetCascade(id);
      }
      for (const row of payload.assetUpserts.junctions) {
        deleteAssetCascade(row.id);
        insertJunction(row);
      }
      for (const row of payload.assetUpserts.reservoirs) {
        deleteAssetCascade(row.id);
        insertReservoir(row);
      }
      for (const row of payload.assetUpserts.tanks) {
        deleteAssetCascade(row.id);
        insertTank(row);
      }
      for (const row of payload.assetUpserts.pipes) {
        deleteAssetCascade(row.id);
        insertPipe(row);
      }
      for (const row of payload.assetUpserts.pumps) {
        deleteAssetCascade(row.id);
        insertPump(row);
      }
      for (const row of payload.assetUpserts.valves) {
        deleteAssetCascade(row.id);
        insertValve(row);
      }
      for (const id of payload.customerPointDeleteIds) {
        deleteCustomerPointCascade(id);
      }
      for (const row of payload.customerPointUpserts) {
        deleteCustomerPoint(row.id);
        insertCustomerPoint(row);
      }
      for (const update of payload.customerPointDemandUpdates) {
        deleteCustomerPointDemands(update.customerPointId);
        for (const demandRow of update.demands) {
          insertCustomerPointDemand(demandRow);
        }
      }
      for (const update of payload.junctionDemandUpdates) {
        deleteJunctionDemands(update.junctionId);
        for (const demandRow of update.demands) {
          insertJunctionDemand(demandRow);
        }
      }
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

  async setAllAssets(payload: AssetRows): Promise<void> {
    await ready;
    if (!db) throw new Error("No database open");
    db.exec("BEGIN IMMEDIATE");
    try {
      for (const table of [
        "junction_properties",
        "reservoir_properties",
        "tank_properties",
        "pipe_properties",
        "pump_properties",
        "valve_properties",
        "link_properties",
        "node_properties",
        "assets",
      ]) {
        db.exec(`DELETE FROM ${table}`);
      }
      for (const row of payload.junctions) insertJunction(row);
      for (const row of payload.reservoirs) insertReservoir(row);
      for (const row of payload.tanks) insertTank(row);
      for (const row of payload.pipes) insertPipe(row);
      for (const row of payload.pumps) insertPump(row);
      for (const row of payload.valves) insertValve(row);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },

  async setAllCustomerPoints(payload: CustomerPointsData): Promise<void> {
    await ready;
    if (!db) throw new Error("No database open");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("DELETE FROM customer_point_demands");
      db.exec("DELETE FROM customer_points");
      for (const row of payload.customerPoints) insertCustomerPoint(row);
      for (const row of payload.demands) insertCustomerPointDemand(row);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },

  async setAllPatterns(rows: PatternRow[]): Promise<void> {
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

  async setAllCurves(rows: CurveRow[]): Promise<void> {
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

  async setAllControls(data: string): Promise<void> {
    await ready;
    if (!db) throw new Error("No database open");
    upsertControls(data);
  },

  async setAllSimulationSettings(data: string): Promise<void> {
    await ready;
    if (!db) throw new Error("No database open");
    upsertSimulationSettings(data);
  },

  async setAllJunctionDemands(rows: JunctionDemandRow[]): Promise<void> {
    await ready;
    if (!db) throw new Error("No database open");
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec("DELETE FROM junction_demands");
      for (const row of rows) insertJunctionDemand(row);
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  },

  async exportDb(): Promise<Uint8Array> {
    await ready;
    if (!db) throw new Error("No database open");
    db.exec(`PRAGMA application_id = ${APP_VERSION}`);
    return sqlite3!.capi.sqlite3_js_db_export(db.pointer!);
  },

  async closeDb() {
    await ready;
    closeExistingDb();
  },
};

export type DbWorkerApi = typeof api;

Comlink.expose(api);
