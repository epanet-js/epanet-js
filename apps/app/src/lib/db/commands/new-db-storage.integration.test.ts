import { describe, expect, it, vi, afterEach } from "vitest";
import { api, setSahpoolForTest } from "@epanet-js/ejsdb/worker-api";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { useInProcessDb } from "../__test-helpers__/in-process-db";
import { importProject } from "./import-project";
import { newProject } from "./new-project";

const sahpoolContentionError = () => {
  const error = new Error(
    "Failed to execute 'createSyncAccessHandle' on 'FileSystemFileHandle': Access Handles cannot be created if there is another open Access Handle or Writable stream associated with the same file.",
  );
  error.name = "NoModificationAllowedError";
  return error;
};

const fakeSahpool = (wipeFiles: () => Promise<void>) =>
  ({ wipeFiles }) as unknown as Parameters<typeof setSahpoolForTest>[0];

describe("newDb storage errors", () => {
  useInProcessDb();

  afterEach(() => {
    setSahpoolForTest(null);
  });

  it("returns ok in memory mode", async () => {
    const result = await api.newDb();

    expect(result).toEqual({ status: "ok" });
  });

  it("retries the pool wipe once and reports a storage error when contention persists", async () => {
    const wipeFiles = vi.fn().mockRejectedValue(sahpoolContentionError());
    setSahpoolForTest(fakeSahpool(wipeFiles));

    const result = await api.newDb();

    expect(result).toMatchObject({
      status: "storage-error",
      errorDetails: expect.stringContaining(
        "Failed to execute 'createSyncAccessHandle'",
      ),
    });
    expect(wipeFiles).toHaveBeenCalledTimes(2);
    await expect(api.getProjectSettings()).rejects.toThrow("No database open");
  });

  it("surfaces the storage error as a typed throw from newProject", async () => {
    setSahpoolForTest(
      fakeSahpool(vi.fn().mockRejectedValue(sahpoolContentionError())),
    );

    await expect(newProject()).rejects.toThrow("newDb storage error");
  });

  it("surfaces the storage error as a typed throw from importProject", async () => {
    setSahpoolForTest(
      fakeSahpool(vi.fn().mockRejectedValue(sahpoolContentionError())),
    );

    await expect(
      importProject({
        newDb: true,
        hydraulicModel: HydraulicModelBuilder.with().build(),
        simulationSettings: defaultSimulationSettings,
      }),
    ).rejects.toThrow("importProject storage error");
  });

  it("releases the dead pool and falls back to memory when it cannot be reinstalled", async () => {
    const removeVfs = vi.fn().mockResolvedValue(undefined);
    setSahpoolForTest({ removeVfs } as unknown as Parameters<
      typeof setSahpoolForTest
    >[0]);

    // No OPFS here, so the reinstall cannot succeed — which is the point: the caller still
    // gets a usable db back, just an in-memory one.
    const mode = await api.reinstallSahpool("tab-fresh");

    expect(removeVfs).toHaveBeenCalledTimes(1);
    expect(mode).toBe("memory");

    // And a fresh db can be created on it, which is what makes the project saveable again.
    expect(await api.newDb()).toEqual({ status: "ok" });
  });

  it("does not touch the pool when importProject reuses the open db", async () => {
    const okResult = await api.newDb();
    expect(okResult).toEqual({ status: "ok" });

    const wipeFiles = vi.fn().mockRejectedValue(sahpoolContentionError());
    setSahpoolForTest(fakeSahpool(wipeFiles));

    await importProject({
      hydraulicModel: HydraulicModelBuilder.with().build(),
      simulationSettings: defaultSimulationSettings,
    });

    expect(wipeFiles).not.toHaveBeenCalled();
  });
});
