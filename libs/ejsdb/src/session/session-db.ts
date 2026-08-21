import { SESSION_VERSION, sessionMigrations } from "./migrations";
import type {
  SessionHistoryDiagnostics,
  SessionHistoryEntry,
  SessionHistoryFailure,
} from "./types";
import { emptySessionHistoryDiagnostics } from "./types";

export const SESSION_DB_PATH = "/session.sqlite3";
export const SESSION_SCHEMA = "sess";

export const MAX_ENTRY_BYTES = 8 * 1024 * 1024;
export const MAX_TOTAL_BYTES = 64 * 1024 * 1024;

type ExecOptions = {
  bind?: unknown[];
  returnValue?: "this" | "resultRows" | "saveSql";
  rowMode?: "array" | "object";
};

export type SessionHostDb = {
  pointer?: number;
  exec: (sql: string, opts?: ExecOptions) => unknown;
};

export type SessionPool = {
  unlink: (filename: string) => boolean;
};

export type SessionStorageMode = "memory" | "sahpool";

let attached = false;

export const isSessionAttached = (): boolean => attached;

export const markSessionDetached = (): void => {
  attached = false;
};

const rows = (db: SessionHostDb, sql: string, bind?: unknown[]): unknown[][] =>
  db.exec(sql, {
    bind,
    returnValue: "resultRows",
    rowMode: "array",
  }) as unknown[][];

const scalar = (db: SessionHostDb, sql: string, bind?: unknown[]): unknown =>
  rows(db, sql, bind)[0]?.[0] ?? null;

const attach = (db: SessionHostDb, storageMode: SessionStorageMode): void => {
  const path = storageMode === "sahpool" ? SESSION_DB_PATH : ":memory:";
  db.exec(`ATTACH DATABASE ? AS ${SESSION_SCHEMA}`, { bind: [path] });
  attached = true;
};

const detach = (
  db: SessionHostDb,
  poolUtil: SessionPool | null,
  storageMode: SessionStorageMode,
): void => {
  if (attached) {
    db.exec(`DETACH DATABASE ${SESSION_SCHEMA}`);
    attached = false;
  }
  if (storageMode === "sahpool" && poolUtil) {
    try {
      poolUtil.unlink(SESSION_DB_PATH);
    } catch {
      // the file may not exist; the session db is disposable either way
    }
  }
};

const build = (db: SessionHostDb, appVersion: number): void => {
  for (const migration of sessionMigrations) {
    db.exec(migration);
  }
  db.exec(`PRAGMA ${SESSION_SCHEMA}.user_version = ${SESSION_VERSION}`);
  db.exec(
    `INSERT INTO ${SESSION_SCHEMA}.session_meta (id, app_version, pointer, created_at)
     VALUES (1, ?, -1, ?)`,
    { bind: [appVersion, Date.now()] },
  );
};

const readSessionVersion = (db: SessionHostDb): number =>
  Number(scalar(db, `PRAGMA ${SESSION_SCHEMA}.user_version`) ?? 0);

const readMetaAppVersion = (db: SessionHostDb): number | null => {
  const value = scalar(
    db,
    `SELECT app_version FROM ${SESSION_SCHEMA}.session_meta WHERE id = 1`,
  );
  return value === null ? null : Number(value);
};

const prepare = (db: SessionHostDb, appVersion: number): boolean => {
  const version = readSessionVersion(db);
  if (version === 0) {
    build(db, appVersion);
    return true;
  }
  if (version !== SESSION_VERSION) return false;

  const metaAppVersion = readMetaAppVersion(db);
  return metaAppVersion !== null && metaAppVersion === appVersion;
};

export const ensureSessionDb = (
  db: SessionHostDb,
  poolUtil: SessionPool | null,
  storageMode: SessionStorageMode,
  appVersion: number,
): void => {
  if (!attached) attach(db, storageMode);
  if (prepare(db, appVersion)) return;

  detach(db, poolUtil, storageMode);
  attach(db, storageMode);
  build(db, appVersion);
};

export const resetSessionDb = (
  db: SessionHostDb | null,
  poolUtil: SessionPool | null,
  storageMode: SessionStorageMode,
): void => {
  if (db) {
    detach(db, poolUtil, storageMode);
    return;
  }
  attached = false;
  if (storageMode === "sahpool" && poolUtil) {
    try {
      poolUtil.unlink(SESSION_DB_PATH);
    } catch {
      // nothing to remove
    }
  }
};

export const truncateHistoryFrom = (db: SessionHostDb, seq: number): void => {
  db.exec(`DELETE FROM ${SESSION_SCHEMA}.history WHERE seq >= ?`, {
    bind: [seq],
  });
};

export const insertHistoryEntry = (
  db: SessionHostDb,
  entry: {
    seq: number;
    stateId: string;
    note: string;
    changeset: Uint8Array;
  },
): { byteSize: number; dropped: boolean } => {
  const byteSize = entry.changeset.length;
  const dropped = byteSize > MAX_ENTRY_BYTES;

  db.exec(
    `INSERT INTO ${SESSION_SCHEMA}.history
       (seq, state_id, note, byte_size, created_at, changeset)
     VALUES (?, ?, ?, ?, ?, ?)`,
    {
      bind: [
        entry.seq,
        entry.stateId,
        entry.note,
        byteSize,
        Date.now(),
        dropped ? null : entry.changeset,
      ],
    },
  );

  return { byteSize, dropped };
};

export const enforceTotalCap = (db: SessionHostDb): boolean => {
  const total = Number(
    scalar(
      db,
      `SELECT COALESCE(SUM(byte_size), 0) FROM ${SESSION_SCHEMA}.history`,
    ) ?? 0,
  );
  if (total <= MAX_TOTAL_BYTES) return false;

  db.exec(
    `DELETE FROM ${SESSION_SCHEMA}.history
      WHERE seq IN (
        SELECT seq FROM (
          SELECT seq, SUM(byte_size) OVER (ORDER BY seq DESC) AS running
            FROM ${SESSION_SCHEMA}.history
        )
        WHERE running > ?
      )
      AND seq < (SELECT MAX(seq) FROM ${SESSION_SCHEMA}.history)`,
    { bind: [MAX_TOTAL_BYTES] },
  );
  return true;
};

export const setHistoryPointer = (db: SessionHostDb, seq: number): void => {
  db.exec(
    `UPDATE ${SESSION_SCHEMA}.session_meta SET pointer = ? WHERE id = 1`,
    { bind: [seq] },
  );
};

export const readSessionDiagnostics = (
  db: SessionHostDb | null,
  options: {
    appVersion: number;
    limit: number;
    enabled?: boolean;
    failure?: SessionHistoryFailure | null;
  },
): SessionHistoryDiagnostics => {
  const { appVersion, limit, enabled = false, failure = null } = options;
  if (!db || !attached) {
    return emptySessionHistoryDiagnostics(
      appVersion,
      SESSION_VERSION,
      enabled,
      failure,
    );
  }

  const [entryCount, totalBytes, oldestSeq, droppedCount] = (rows(
    db,
    `SELECT COUNT(*),
            COALESCE(SUM(byte_size), 0),
            MIN(seq),
            COALESCE(SUM(changeset IS NULL), 0)
       FROM ${SESSION_SCHEMA}.history`,
  )[0] ?? [0, 0, null, 0]) as [number, number, number | null, number];

  const pageCount = Number(
    scalar(db, `PRAGMA ${SESSION_SCHEMA}.page_count`) ?? 0,
  );
  const pageSize = Number(
    scalar(db, `PRAGMA ${SESSION_SCHEMA}.page_size`) ?? 0,
  );

  const meta = rows(
    db,
    `SELECT app_version, pointer FROM ${SESSION_SCHEMA}.session_meta WHERE id = 1`,
  )[0] as [number, number] | undefined;

  const entries: SessionHistoryEntry[] = rows(
    db,
    `SELECT seq, state_id, note, byte_size, created_at, changeset IS NOT NULL
       FROM ${SESSION_SCHEMA}.history
      ORDER BY seq DESC
      LIMIT ?`,
    [limit],
  ).map((row) => ({
    seq: Number(row[0]),
    stateId: String(row[1]),
    note: String(row[2]),
    byteSize: Number(row[3]),
    createdAt: Number(row[4]),
    hasChangeset: Boolean(row[5]),
  }));

  return {
    enabled,
    failure,
    attached: true,
    appVersion,
    sessionVersion: SESSION_VERSION,
    metaAppVersion: meta ? Number(meta[0]) : null,
    pointer: meta ? Number(meta[1]) : -1,
    entryCount: Number(entryCount),
    oldestSeq: oldestSeq === null ? null : Number(oldestSeq),
    totalBytes: Number(totalBytes),
    droppedCount: Number(droppedCount),
    dbBytes: pageCount * pageSize,
    entries,
  };
};
