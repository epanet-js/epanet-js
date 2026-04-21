import * as Comlink from "comlink";
import { APP_VERSION, migrations } from "./migrations";

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
