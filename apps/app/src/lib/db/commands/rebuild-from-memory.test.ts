import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { initializeZones } from "src/lib/zones";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { defaultProjectSettings } from "@epanet-js/project-settings";

const reinstallSahpool = vi.fn<(appId: string) => Promise<string>>();
const configure =
  vi.fn<(args: { mode: string; sahpoolId: string }) => Promise<string>>();
const sahpoolFailure = vi.fn<() => { name: string; message: string } | null>(
  () => null,
);
vi.mock("@epanet-js/ejsdb", async (importActual) => ({
  ...(await importActual<typeof import("@epanet-js/ejsdb")>()),
  getWorker: () => ({
    reinstallSahpool,
    sahpoolFailure,
    configure,
  }),
}));

const resetAppId = vi.fn(() => "tab-fresh");
vi.mock("src/infra/app-instance", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/app-instance")>()),
  resetAppId: () => resetAppId(),
}));

const holdSessionLock = vi.fn<(appId: string) => Promise<void>>(() =>
  Promise.resolve(),
);
vi.mock("src/infra/session-lock", () => ({
  holdSessionLock: (appId: string) => holdSessionLock(appId),
  isSessionAlive: () => Promise.resolve(false),
}));

const importProject = vi.fn<(input: unknown) => Promise<void>>(() =>
  Promise.resolve(),
);
vi.mock("./import-project", () => ({
  importProject: (input: unknown) => importProject(input),
}));

const addToErrorLog = vi.fn<(crumb: unknown) => void>();
vi.mock("src/infra/error-tracking", async (importActual) => ({
  ...(await importActual<typeof import("src/infra/error-tracking")>()),
  addToErrorLog: (crumb: unknown) => {
    addToErrorLog(crumb);
  },
}));

import { rebuildDbFromMemory } from "./rebuild-from-memory";

const anInput = () => ({
  hydraulicModel: HydraulicModelBuilder.with().aJunction(1).build(),
  projectSettings: defaultProjectSettings,
  simulationSettings: defaultSimulationSettings,
  zones: initializeZones(),
});

beforeEach(() => {
  vi.clearAllMocks();
  importProject.mockResolvedValue(undefined);
  configure.mockResolvedValue("memory");
});

describe("rebuildDbFromMemory", () => {
  it("reinstalls OPFS on a fresh pool and holds its lock", async () => {
    reinstallSahpool.mockResolvedValue("sahpool");

    const mode = await rebuildDbFromMemory(anInput());

    expect(mode).toBe("opfs");
    // The old directory is what failed, so the retry must not reuse it.
    expect(resetAppId).toHaveBeenCalledTimes(1);
    expect(reinstallSahpool).toHaveBeenCalledWith("tab-fresh");
    expect(holdSessionLock).toHaveBeenCalledWith("tab-fresh");
  });

  it("falls back to memory and records why when OPFS cannot be reinstalled", async () => {
    reinstallSahpool.mockResolvedValue("memory");
    sahpoolFailure.mockReturnValue({
      name: "NotAllowedError",
      message: "no access handle",
    });

    const mode = await rebuildDbFromMemory(anInput());

    expect(mode).toBe("memory");
    expect(holdSessionLock).not.toHaveBeenCalled();
    expect(addToErrorLog).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: "NotAllowedError" }),
      }),
    );
  });

  it("writes the whole model into a fresh db", async () => {
    reinstallSahpool.mockResolvedValue("sahpool");

    await rebuildDbFromMemory(anInput());

    expect(importProject).toHaveBeenCalledWith(
      expect.objectContaining({ newDb: true }),
    );
  });

  it("includes zones, which every other importProject call site omits", async () => {
    reinstallSahpool.mockResolvedValue("sahpool");
    const input = anInput();

    await rebuildDbFromMemory(input);

    expect(importProject).toHaveBeenCalledWith(
      expect.objectContaining({ zones: input.zones }),
    );
  });

  it("reports each phase so the dialog can follow along", async () => {
    reinstallSahpool.mockResolvedValue("sahpool");
    const phases: string[] = [];

    await rebuildDbFromMemory(anInput(), {
      onPhase: (phase) => phases.push(phase),
    });

    expect(phases).toEqual(["storage", "writing", "finalizing"]);
  });

  it("skips OPFS entirely once the caller has given up on it", async () => {
    const mode = await rebuildDbFromMemory(anInput(), { skipOpfs: true });

    expect(mode).toBe("memory");
    expect(reinstallSahpool).not.toHaveBeenCalled();
    expect(configure).toHaveBeenCalledWith(
      expect.objectContaining({ mode: "memory" }),
    );
    // Still writes the whole model — skipping OPFS is not skipping the rebuild.
    expect(importProject).toHaveBeenCalledWith(
      expect.objectContaining({ newDb: true }),
    );
  });

  it("propagates a failed write so the caller can go terminal", async () => {
    reinstallSahpool.mockResolvedValue("memory");
    importProject.mockRejectedValue(new Error("import blew up"));

    await expect(rebuildDbFromMemory(anInput())).rejects.toThrow(
      "import blew up",
    );
  });
});
