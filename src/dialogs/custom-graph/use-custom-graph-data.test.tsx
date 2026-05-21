import { act } from "react";
import { renderHook, waitFor } from "@testing-library/react";
import { HydraulicModelBuilder } from "src/__helpers__/hydraulic-model-builder";
import { setInitialState } from "src/__helpers__/state";
import { CommandContainer } from "src/commands/__helpers__/command-container";
import { EPSResultsReader } from "src/simulation";
import { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import { SimulationState } from "src/state";
import { useCustomGraphData } from "./use-custom-graph-data";

const IDS = { J1: 1, J2: 2, P1: 3, P2: 4 } as const;

const renderDataHook = (store: ReturnType<typeof setInitialState>) => {
  const onProgress = vi.fn();
  const hook = renderHook(() => useCustomGraphData(onProgress), {
    wrapper: ({ children }) => (
      <CommandContainer store={store}>{children}</CommandContainer>
    ),
  });
  return { ...hook, onProgress };
};

describe("useCustomGraphData", () => {
  it("returns empty series when no simulation results exist", async () => {
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J1).build(),
      selection: { type: "single", id: IDS.J1, parts: [] },
    });

    const { result, onProgress } = renderDataHook(store);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodeSeriesData).toHaveLength(0);
    expect(result.current.linkSeriesData).toHaveLength(0);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("returns empty series when no assets are selected", async () => {
    const reader = makeResultsReader(1, 3600, {});
    const store = setInitialState({
      hydraulicModel: HydraulicModelBuilder.with().aJunction(IDS.J1).build(),
      simulation: makeSimulation(reader),
    });

    const { result } = renderDataHook(store);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.nodeSeriesData).toHaveLength(0);
    expect(result.current.linkSeriesData).toHaveLength(0);
  });

  it("loads node and link series data for selected assets", async () => {
    const reader = makeResultsReader(3, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([10, 15, 20]),
      [`${IDS.P1}:flow`]: makeTimeSeries([5, 6, 7]),
    });

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1, { label: "J1" })
      .aPipe(IDS.P1, { startNodeId: IDS.J1, label: "P1" })
      .build();

    const store = setInitialState({
      hydraulicModel: model,
      simulation: makeSimulation(reader),
      selection: { type: "multi", ids: [IDS.J1, IDS.P1] },
    });

    const { result } = renderDataHook(store);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasNodes).toBe(true);
    expect(result.current.hasLinks).toBe(true);
    expect(result.current.nodeSeriesData).toHaveLength(1);
    expect(result.current.linkSeriesData).toHaveLength(1);
    expect(result.current.nodeSeriesData[0].label).toBe("J1");
    expect(result.current.linkSeriesData[0].label).toBe("P1");
    expect(
      Array.from(result.current.nodeSeriesData[0].timeSeries.values),
    ).toEqual([10, 15, 20]);
    expect(
      Array.from(result.current.linkSeriesData[0].timeSeries.values),
    ).toEqual([5, 6, 7]);
  });

  it("reports progress during loading", async () => {
    const reader = makeResultsReader(1, 3600, {
      [`${IDS.J1}:pressure`]: makeTimeSeries([10]),
      [`${IDS.P1}:flow`]: makeTimeSeries([5]),
    });

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1 })
      .build();

    const store = setInitialState({
      hydraulicModel: model,
      simulation: makeSimulation(reader),
      selection: { type: "multi", ids: [IDS.J1, IDS.P1] },
    });

    const { result, onProgress } = renderDataHook(store);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(onProgress).toHaveBeenCalledWith(0);
    expect(onProgress).toHaveBeenCalledWith(100);
  });

  it("applies absolute value transform for flowAbsolute property", async () => {
    const reader = makeResultsReader(3, 3600, {
      [`${IDS.P1}:flow`]: makeTimeSeries([-5, 6, -7]),
    });

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1 })
      .build();

    const store = setInitialState({
      hydraulicModel: model,
      simulation: makeSimulation(reader),
      selection: { type: "single", id: IDS.P1, parts: [] },
    });

    const { result } = renderDataHook(store);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setLinkProperty("flowAbsolute");
    });

    await waitFor(() => {
      expect(result.current.linkSeriesData).toHaveLength(1);
      const values = Array.from(
        result.current.linkSeriesData[0].timeSeries.values,
      );
      expect(values).toEqual([5, 6, 7]);
    });
  });

  it("maps status values to 0 (closed) and 1 (open)", async () => {
    const reader = makeResultsReader(4, 3600, {
      [`${IDS.P1}:status`]: makeTimeSeries([0, 2, 3, 5]),
    });

    const model = HydraulicModelBuilder.with()
      .aJunction(IDS.J1)
      .aPipe(IDS.P1, { startNodeId: IDS.J1 })
      .build();

    const store = setInitialState({
      hydraulicModel: model,
      simulation: makeSimulation(reader),
      selection: { type: "single", id: IDS.P1, parts: [] },
    });

    const { result } = renderDataHook(store);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    act(() => {
      result.current.setLinkProperty("status");
    });

    await waitFor(() => {
      const values = Array.from(
        result.current.linkSeriesData[0].timeSeries.values,
      );
      expect(values).toEqual([0, 0, 1, 1]);
    });
  });

});

const makeSimulation = (reader: EPSResultsReader): SimulationState =>
  ({
    status: "success",
    report: "",
    modelVersion: 0,
    settingsVersion: "",
    epsResultsReader: reader,
  }) as unknown as SimulationState;

const makeResultsReader = (
  timestepCount: number,
  reportingTimeStep: number,
  data: Record<string, TimeSeries | null>,
): EPSResultsReader =>
  ({
    timestepCount,
    reportingTimeStep,
    qualityType: "none" as const,
    iterateTimeSeries: vi.fn(
      async (
        assets: Map<number, { id: number; type: string }>,
        metrics: string[],
        onResult: (
          metric: string,
          asset: { id: number; type: string },
          ts: TimeSeries | null,
        ) => Promise<void>,
      ) => {
        for (const metric of metrics) {
          for (const asset of assets.values()) {
            await onResult(
              metric,
              asset,
              data[`${asset.id}:${metric}`] ?? null,
            );
          }
        }
      },
    ),
  }) as unknown as EPSResultsReader;

const makeTimeSeries = (values: number[]): TimeSeries => ({
  values: new Float32Array(values),
  intervalsCount: values.length,
  intervalSeconds: 3600,
});
