import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { buildInp } from "../build-inp";
import { presets } from "@epanet-js/project-settings";
import { defaultSimulationSettings } from "src/simulation/simulation-settings";
import { patchEpanetLoader } from "src/__helpers__/epanet-loader";
import { Workspace } from "epanet-js/slim";
import {
  runSimulation,
  configureWorkerReuse,
  warmupSimulationEngine,
  resetSimulationWorkerForTest,
} from "./worker";

const buildSimpleInp = () => {
  const IDS = { R1: 1, J1: 2, P1: 3 } as const;
  const hydraulicModel = HydraulicModelBuilder.with()
    .aReservoir(IDS.R1, { head: 100 })
    .aJunction(IDS.J1, { elevation: 0 })
    .aPipe(IDS.P1, {
      startNodeId: IDS.R1,
      endNodeId: IDS.J1,
      length: 100,
      diameter: 100,
      roughness: 100,
    })
    .build();
  return buildInp(hydraulicModel, {
    units: presets.LPS.units,
    simulationSettings: defaultSimulationSettings,
  });
};

describe("simulation worker reuse", () => {
  beforeAll(() => patchEpanetLoader());

  afterEach(() => {
    resetSimulationWorkerForTest();
  });

  it("reuses a single workspace across runs when reuse is enabled", async () => {
    const loadSpy = vi.spyOn(Workspace.prototype, "loadModuleVersion");
    configureWorkerReuse(true);

    const inp = buildSimpleInp();
    const first = await runSimulation(inp, "reuse-1", () => {});
    const second = await runSimulation(inp, "reuse-2", () => {});

    expect(first.status).toEqual("success");
    expect(second.status).toEqual("success");
    expect(loadSpy).toHaveBeenCalledTimes(1);

    loadSpy.mockRestore();
  });

  it("creates a fresh workspace per run when reuse is disabled", async () => {
    const loadSpy = vi.spyOn(Workspace.prototype, "loadModuleVersion");

    const inp = buildSimpleInp();
    await runSimulation(inp, "no-reuse-1", () => {});
    await runSimulation(inp, "no-reuse-2", () => {});

    expect(loadSpy).toHaveBeenCalledTimes(2);

    loadSpy.mockRestore();
  });

  it("cleans up workspace files after each run when reuse is enabled", async () => {
    const loadSpy = vi.spyOn(Workspace.prototype, "loadModuleVersion");
    configureWorkerReuse(true);

    const inp = buildSimpleInp();
    await runSimulation(inp, "cleanup-1", () => {});

    const ws = loadSpy.mock.instances[0] as unknown as Workspace;
    const fs = ws.instance.FS as { readdir: (path: string) => string[] };
    const entries = fs.readdir("/");
    expect(entries).not.toContain("net.inp");
    expect(entries).not.toContain("report.rpt");
    expect(entries).not.toContain("results.out");

    loadSpy.mockRestore();
  });

  it("warms the engine once and reuses the warmed workspace", async () => {
    const loadSpy = vi.spyOn(Workspace.prototype, "loadModuleVersion");
    configureWorkerReuse(true);

    await warmupSimulationEngine();
    const inp = buildSimpleInp();
    const result = await runSimulation(inp, "warmup-1", () => {});

    expect(result.status).toEqual("success");
    expect(loadSpy).toHaveBeenCalledTimes(1);

    loadSpy.mockRestore();
  });
});
