import { afterEach, describe, expect, it } from "vitest";
import { createMemoryDbForTest, type OoDb } from "../worker-api";
import { APP_VERSION, migrations } from "../migrations";
import { SESSION_VERSION } from "./migrations";
import {
  SESSION_SCHEMA,
  ensureSessionDb,
  insertHistoryEntry,
  markSessionDetached,
  readSessionDiagnostics,
  setHistoryPointer,
  truncateHistoryFrom,
} from "./session-db";

const rows = (db: OoDb, sql: string): unknown[][] =>
  db.exec(sql, { returnValue: "resultRows", rowMode: "array" }) as unknown[][];

const openProjectDb = async (): Promise<OoDb> => {
  const db = await createMemoryDbForTest();
  for (const migration of migrations) {
    if (typeof migration === "string") db.exec(migration);
    else migration(db);
  }
  db.exec(`PRAGMA user_version = ${migrations.length}`);
  return db;
};

const mainSchema = (db: OoDb) =>
  rows(db, "SELECT type, name, sql FROM main.sqlite_master ORDER BY name");

const attachSession = (db: OoDb, appVersion: number = APP_VERSION) =>
  ensureSessionDb(db, null, "memory", appVersion);

const addEntry = (db: OoDb, seq: number, note: string) =>
  insertHistoryEntry(db, {
    seq,
    stateId: `state-${seq}`,
    note,
    changeset: new Uint8Array([1, 2, 3, 4]),
  });

let openDb: OoDb | null = null;

const withProjectDb = async (): Promise<OoDb> => {
  openDb = await openProjectDb();
  return openDb;
};

afterEach(() => {
  markSessionDetached();
  openDb?.close();
  openDb = null;
});

describe("session db", () => {
  it("attaches, migrates and seeds its metadata", async () => {
    const db = await withProjectDb();

    attachSession(db);

    const diagnostics = readSessionDiagnostics(db, {
      appVersion: APP_VERSION,
      limit: 10,
    });
    expect(diagnostics.attached).toBe(true);
    expect(diagnostics.sessionVersion).toBe(SESSION_VERSION);
    expect(diagnostics.metaAppVersion).toBe(APP_VERSION);
    expect(diagnostics.pointer).toBe(-1);
    expect(diagnostics.entryCount).toBe(0);
    expect(diagnostics.dbBytes).toBeGreaterThan(0);
  });

  it("keeps existing entries when called again", async () => {
    const db = await withProjectDb();
    attachSession(db);
    addEntry(db, 0, "first edit");

    attachSession(db);

    expect(
      readSessionDiagnostics(db, { appVersion: APP_VERSION, limit: 10 })
        .entryCount,
    ).toBe(1);
  });

  it("recreates when the project schema version moved", async () => {
    const db = await withProjectDb();
    attachSession(db);
    addEntry(db, 0, "first edit");

    attachSession(db, APP_VERSION + 1);

    const diagnostics = readSessionDiagnostics(db, {
      appVersion: APP_VERSION + 1,
      limit: 10,
    });
    expect(diagnostics.entryCount).toBe(0);
    expect(diagnostics.metaAppVersion).toBe(APP_VERSION + 1);
  });

  it("recreates when its own schema version is unexpected", async () => {
    const db = await withProjectDb();
    attachSession(db);
    addEntry(db, 0, "first edit");
    db.exec(`PRAGMA ${SESSION_SCHEMA}.user_version = ${SESSION_VERSION + 7}`);

    attachSession(db);

    expect(
      readSessionDiagnostics(db, { appVersion: APP_VERSION, limit: 10 })
        .entryCount,
    ).toBe(0);
  });

  it("records entries, drops the future on truncate and moves the pointer", async () => {
    const db = await withProjectDb();
    attachSession(db);

    addEntry(db, 0, "first edit");
    addEntry(db, 1, "second edit");
    setHistoryPointer(db, 1);
    truncateHistoryFrom(db, 1);
    addEntry(db, 1, "replacement edit");
    setHistoryPointer(db, 1);

    const diagnostics = readSessionDiagnostics(db, {
      appVersion: APP_VERSION,
      limit: 10,
    });
    expect(diagnostics.entryCount).toBe(2);
    expect(diagnostics.pointer).toBe(1);
    expect(diagnostics.entries.map((entry) => entry.note)).toEqual([
      "replacement edit",
      "first edit",
    ]);
  });

  it("stores an oversized changeset without its blob", async () => {
    const db = await withProjectDb();
    attachSession(db);

    const oversized = new Uint8Array(9 * 1024 * 1024);
    const result = insertHistoryEntry(db, {
      seq: 0,
      stateId: "state-0",
      note: "huge edit",
      changeset: oversized,
    });

    expect(result.dropped).toBe(true);
    const diagnostics = readSessionDiagnostics(db, {
      appVersion: APP_VERSION,
      limit: 10,
    });
    expect(diagnostics.droppedCount).toBe(1);
    expect(diagnostics.entries[0].byteSize).toBe(oversized.length);
    expect(diagnostics.entries[0].hasChangeset).toBe(false);
  });

  it("never touches the project schema", async () => {
    const db = await withProjectDb();
    const before = mainSchema(db);

    attachSession(db);
    addEntry(db, 0, "first edit");

    expect(mainSchema(db)).toEqual(before);
  });

  it("has a primary key on every project table", async () => {
    const db = await withProjectDb();

    const tables = rows(
      db,
      `SELECT name FROM main.sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`,
    ).map((row) => String(row[0]));

    expect(tables.length).toBeGreaterThan(0);
    const withoutPrimaryKey = tables.filter(
      (table) =>
        !rows(db, `PRAGMA main.table_info(${table})`).some(
          (column) => Number(column[5]) > 0,
        ),
    );

    expect(withoutPrimaryKey).toEqual([]);
  });
});
