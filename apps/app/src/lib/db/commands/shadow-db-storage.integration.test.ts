import { describe, expect, it, vi, afterEach } from "vitest";
import {
  api,
  createMemoryDbForTest,
  setSahpoolForTest,
  type OoDb,
} from "@epanet-js/ejsdb/worker-api";
import type { ShadowErrorReport } from "@epanet-js/ejsdb";
import { useInProcessDb } from "../__test-helpers__/in-process-db";

const sahpoolContentionError = () => {
  const error = new Error(
    "Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle or Writable stream associated with the same file.",
  );
  error.name = "NoModificationAllowedError";
  return error;
};

type FakeShadowPool = {
  pool: Parameters<typeof setSahpoolForTest>[0];
  getShadowDb: () => OoDb | null;
};

const fakeShadowPool = async (
  overrides: { wipeFiles?: () => Promise<void> } = {},
  dbCount = 1,
): Promise<FakeShadowPool> => {
  const queue: OoDb[] = [];
  for (let i = 0; i < dbCount; i++) {
    queue.push(await createMemoryDbForTest());
  }
  let current: OoDb | null = null;
  const pool = {
    wipeFiles: overrides.wipeFiles ?? (() => Promise.resolve()),
    importDb: () => Promise.resolve(),
    OpfsSAHPoolDb: function () {
      current = queue.shift() ?? null;
      return current;
    },
  } as unknown as Parameters<typeof setSahpoolForTest>[0];
  return { pool, getShadowDb: () => current };
};

const readShadowSettings = (shadowDb: OoDb): string[][] =>
  shadowDb.exec("SELECT settings FROM project WHERE id = 1", {
    returnValue: "resultRows",
  }) as string[][];

describe("shadow db storage", () => {
  useInProcessDb();

  afterEach(() => {
    setSahpoolForTest(null);
  });

  it("returns ok and runs migrations on the shadow", async () => {
    const { pool, getShadowDb } = await fakeShadowPool();
    setSahpoolForTest(pool, "shadow");

    const result = await api.newDb();

    expect(result).toEqual({ status: "ok" });
    const rows = getShadowDb()!.exec("PRAGMA user_version", {
      returnValue: "resultRows",
    }) as number[][];
    expect(rows[0][0]).toBeGreaterThan(0);
  });

  it("applies writes to both databases", async () => {
    const { pool, getShadowDb } = await fakeShadowPool();
    setSahpoolForTest(pool, "shadow");
    await api.newDb();

    await api.saveProjectSettings('{"name":"shadowed"}');

    expect(await api.getProjectSettings()).toBe('{"name":"shadowed"}');
    const rows = readShadowSettings(getShadowDb()!);
    expect(rows[0][0]).toBe('{"name":"shadowed"}');
  });

  it("stays ok and reports when the shadow wipe fails at newDb", async () => {
    const reporter = vi.fn<(report: ShadowErrorReport) => void>();
    const { pool } = await fakeShadowPool({
      wipeFiles: vi.fn().mockRejectedValue(sahpoolContentionError()),
    });
    setSahpoolForTest(pool, "shadow");
    api.setShadowErrorReporter(reporter);

    const result = await api.newDb();

    expect(result).toEqual({ status: "ok" });
    await api.saveProjectSettings('{"name":"still-works"}');
    expect(await api.getProjectSettings()).toBe('{"name":"still-works"}');
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: "newDb",
        errorName: "NoModificationAllowedError",
        shadowDisabled: true,
      }),
    );
  });

  it("disables the shadow and reports once when a shadow transaction fails", async () => {
    const reporter = vi.fn<(report: ShadowErrorReport) => void>();
    const { pool, getShadowDb } = await fakeShadowPool();
    setSahpoolForTest(pool, "shadow");
    api.setShadowErrorReporter(reporter);
    await api.newDb();

    const shadowDb = getShadowDb()!;
    const originalExec = shadowDb.exec.bind(shadowDb);
    let shadowExecCalls = 0;
    shadowDb.exec = ((sql: string, opts?: unknown) => {
      shadowExecCalls++;
      if (sql !== "BEGIN IMMEDIATE" && sql !== "ROLLBACK") {
        throw sahpoolContentionError();
      }
      return originalExec(sql, opts as never);
    }) as OoDb["exec"];

    await api.saveProjectSettings('{"name":"first"}');

    expect(await api.getProjectSettings()).toBe('{"name":"first"}');
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "saveProjectSettings",
        phase: "transaction",
        isFirstFailure: true,
        shadowDisabled: true,
      }),
    );

    const callsAfterFailure = shadowExecCalls;
    await api.saveProjectSettings('{"name":"second"}');

    expect(await api.getProjectSettings()).toBe('{"name":"second"}');
    expect(reporter).toHaveBeenCalledTimes(1);
    expect(shadowExecCalls).toBe(callsAfterFailure);
  });

  it("exports the primary content even when the shadow diverges", async () => {
    const { pool, getShadowDb } = await fakeShadowPool();
    setSahpoolForTest(pool, "shadow");
    await api.newDb();
    await api.saveProjectSettings('{"name":"primary"}');
    getShadowDb()!.exec('UPDATE project SET settings = \'{"name":"drift"}\'');

    const bytes = await api.exportDb();
    setSahpoolForTest(null);
    const result = await api.openDb(bytes);

    expect(result).toMatchObject({ status: "ok" });
    expect(await api.getProjectSettings()).toBe('{"name":"primary"}');
  });

  it("reads from the primary even when the shadow diverges", async () => {
    const { pool, getShadowDb } = await fakeShadowPool();
    setSahpoolForTest(pool, "shadow");
    await api.newDb();
    await api.saveProjectSettings('{"name":"primary"}');

    getShadowDb()!.exec('UPDATE project SET settings = \'{"name":"drift"}\'');

    expect(await api.getProjectSettings()).toBe('{"name":"primary"}');
  });

  it("re-arms the shadow on the next newDb after a failure", async () => {
    const reporter = vi.fn<(report: ShadowErrorReport) => void>();
    const { pool, getShadowDb } = await fakeShadowPool({}, 2);
    setSahpoolForTest(pool, "shadow");
    api.setShadowErrorReporter(reporter);
    await api.newDb();

    const brokenShadow = getShadowDb()!;
    brokenShadow.exec = (() => {
      throw sahpoolContentionError();
    }) as OoDb["exec"];
    await api.saveProjectSettings('{"name":"first"}');
    expect(reporter).toHaveBeenCalledTimes(1);

    await api.newDb();
    await api.saveProjectSettings('{"name":"after-rearm"}');

    expect(readShadowSettings(getShadowDb()!)[0][0]).toBe(
      '{"name":"after-rearm"}',
    );
  });
});
