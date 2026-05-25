import { screen, render, waitFor } from "@testing-library/react";
import { CommandContainer } from "./__helpers__/command-container";
import { SimulationFinished } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { Store } from "src/state";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import {
  defaultSimulationSettings,
  maxTransientThreads,
} from "src/simulation/simulation-settings";
import type { HydraulicModel } from "src/hydraulic-model";
import userEvent from "@testing-library/user-event";
import { useRunSimulation } from "./run-simulation";
import { runPtsnetSimulation } from "src/simulation/ptsnet";
import type { PtsnetWorkerResult } from "src/simulation/ptsnet";
import { Mock } from "vitest";

// The simulate button runs ptsnet in a worker; mock the worker wrapper so the
// command (and the real TransientResultsReader) can be exercised in jsdom.
vi.mock("src/simulation/ptsnet", () => ({
  runPtsnetSimulation: vi.fn(),
}));

const IDS = { r1: 1, j1: 2, v1: 3 } as const;

const aModelWithValve = (): HydraulicModel =>
  HydraulicModelBuilder.with()
    .aReservoir(IDS.r1)
    .aJunction(IDS.j1)
    .aValve(IDS.v1, { startNodeId: IDS.r1, endNodeId: IDS.j1 })
    .build();

const fakeResult = (): PtsnetWorkerResult => ({
  serialized: {
    time: [0, 0.01, 0.02],
    node: {
      head: { labels: ["2"], cols: 3, data: [10, 11, 12] },
      leakFlow: { labels: [], cols: 3, data: [] },
      demandFlow: { labels: [], cols: 3, data: [] },
    },
    pipeStart: { flowrate: { labels: ["3"], cols: 3, data: [1, 0.5, 0] } },
    pipeEnd: { flowrate: { labels: ["3"], cols: 3, data: [1, 0.5, 0] } },
  },
  nodeLabels: ["1", "2"],
  nodeElevation: [0, 0],
  nodeType: [1, 0],
});

describe("Run simulation (transient)", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("runs ptsnet and attaches a transient reader on success", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    (runPtsnetSimulation as unknown as Mock).mockResolvedValue(fakeResult());

    const hydraulicModel = aModelWithValve();
    const valveLabel = hydraulicModel.assets.get(IDS.v1)!.label;
    const store = setInitialState({
      hydraulicModel,
      simulationSettings: {
        ...defaultSimulationSettings,
        transientsEnabled: true,
        transientValveId: valveLabel,
      },
    });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationDerivedAtom) as SimulationFinished;
      expect(simulation.status).toEqual("success");
      const reader =
        "epsResultsReader" in simulation ? simulation.epsResultsReader : null;
      expect(reader).toBeTruthy();
      expect(reader?.isTransient).toBe(true);
      expect(reader?.timestepCount).toEqual(3);
    });
    expect(runPtsnetSimulation).toHaveBeenCalledTimes(1);
  });

  it("passes the configured wave speed method through to ptsnet", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    (runPtsnetSimulation as unknown as Mock).mockResolvedValue(fakeResult());

    const hydraulicModel = aModelWithValve();
    const valveLabel = hydraulicModel.assets.get(IDS.v1)!.label;
    const store = setInitialState({
      hydraulicModel,
      simulationSettings: {
        ...defaultSimulationSettings,
        transientsEnabled: true,
        transientValveId: valveLabel,
        transientWaveSpeedMethod: "user",
      },
    });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      expect(runPtsnetSimulation).toHaveBeenCalledTimes(1);
    });
    const [input] = (runPtsnetSimulation as unknown as Mock).mock.calls[0];
    expect(input.settings.waveSpeedMethod).toEqual("user");
  });

  it("defaults to the optimal wave speed method", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    (runPtsnetSimulation as unknown as Mock).mockResolvedValue(fakeResult());

    const hydraulicModel = aModelWithValve();
    const valveLabel = hydraulicModel.assets.get(IDS.v1)!.label;
    const store = setInitialState({
      hydraulicModel,
      simulationSettings: {
        ...defaultSimulationSettings,
        transientsEnabled: true,
        transientValveId: valveLabel,
      },
    });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      expect(runPtsnetSimulation).toHaveBeenCalledTimes(1);
    });
    const [input] = (runPtsnetSimulation as unknown as Mock).mock.calls[0];
    expect(input.settings.waveSpeedMethod).toEqual("optimal");
  });

  it("passes the configured thread count through to ptsnet, clamped to the device max", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    (runPtsnetSimulation as unknown as Mock).mockResolvedValue(fakeResult());

    const hydraulicModel = aModelWithValve();
    const valveLabel = hydraulicModel.assets.get(IDS.v1)!.label;
    const store = setInitialState({
      hydraulicModel,
      simulationSettings: {
        ...defaultSimulationSettings,
        transientsEnabled: true,
        transientValveId: valveLabel,
        // Above any real core count: must be clamped down to the device max.
        transientThreads: 9999,
      },
    });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      expect(runPtsnetSimulation).toHaveBeenCalledTimes(1);
    });
    const [input] = (runPtsnetSimulation as unknown as Mock).mock.calls[0];
    expect(input.settings.workers).toEqual(maxTransientThreads());
  });

  it("skips the results reader when saving is disabled but still succeeds", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    (runPtsnetSimulation as unknown as Mock).mockResolvedValue(fakeResult());

    const hydraulicModel = aModelWithValve();
    const valveLabel = hydraulicModel.assets.get(IDS.v1)!.label;
    const store = setInitialState({
      hydraulicModel,
      simulationSettings: {
        ...defaultSimulationSettings,
        transientsEnabled: true,
        transientValveId: valveLabel,
        transientSaveResults: false,
      },
    });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationDerivedAtom) as SimulationFinished;
      expect(simulation.status).toEqual("success");
    });
    const [input] = (runPtsnetSimulation as unknown as Mock).mock.calls[0];
    expect(input.settings.saveResults).toBe(false);

    const simulation = store.get(simulationDerivedAtom) as SimulationFinished;
    const reader =
      "epsResultsReader" in simulation ? simulation.epsResultsReader : null;
    expect(reader).toBeFalsy();
  });

  it("fails with a readable message when not cross-origin isolated", async () => {
    vi.stubGlobal("crossOriginIsolated", false);

    const hydraulicModel = aModelWithValve();
    const valveLabel = hydraulicModel.assets.get(IDS.v1)!.label;
    const store = setInitialState({
      hydraulicModel,
      simulationSettings: {
        ...defaultSimulationSettings,
        transientValveId: valveLabel,
      },
    });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationDerivedAtom) as SimulationFinished;
      expect(simulation.status).toEqual("failure");
      expect(simulation.report).toMatch(/cross-origin/i);
    });
    expect(runPtsnetSimulation).not.toHaveBeenCalled();
  });

  it("fails when the configured valve does not exist", async () => {
    vi.stubGlobal("crossOriginIsolated", true);

    const store = setInitialState({
      hydraulicModel: aModelWithValve(),
      simulationSettings: {
        ...defaultSimulationSettings,
        transientValveId: "does-not-exist",
      },
    });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationDerivedAtom) as SimulationFinished;
      expect(simulation.status).toEqual("failure");
      expect(simulation.report).toMatch(/not found/i);
    });
    expect(runPtsnetSimulation).not.toHaveBeenCalled();
  });

  it("fails with a readable message when ptsnet throws", async () => {
    vi.stubGlobal("crossOriginIsolated", true);
    (runPtsnetSimulation as unknown as Mock).mockRejectedValue(
      new Error("boom"),
    );

    const hydraulicModel = aModelWithValve();
    const valveLabel = hydraulicModel.assets.get(IDS.v1)!.label;
    const store = setInitialState({
      hydraulicModel,
      simulationSettings: {
        ...defaultSimulationSettings,
        transientValveId: valveLabel,
      },
    });
    renderComponent({ store });

    await triggerRun();

    await waitFor(() => {
      const simulation = store.get(simulationDerivedAtom) as SimulationFinished;
      expect(simulation.status).toEqual("failure");
      expect(simulation.report).toMatch(/boom/i);
    });
  });

  const triggerRun = async () => {
    await userEvent.click(
      screen.getByRole("button", { name: "runSimulation" }),
    );
  };

  const TestableComponent = () => {
    const runSimulation = useRunSimulation();

    return (
      <button aria-label="runSimulation" onClick={() => runSimulation()}>
        Run
      </button>
    );
  };

  const renderComponent = ({ store }: { store: Store }) => {
    render(
      <CommandContainer store={store}>
        <TestableComponent />
      </CommandContainer>,
    );
  };
});
