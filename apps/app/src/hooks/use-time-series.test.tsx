/** @vitest-environment jsdom */
import { act, renderHook } from "@testing-library/react";
import { Provider } from "jotai";
import { setInitialState } from "src/__helpers__/state";
import type { SimulationState } from "src/state/simulation";
import type { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import { useTimeSeries } from "./use-time-series";

const seriesOf = (value: number) =>
  ({
    values: new Float32Array([value, value]),
    intervalsCount: 2,
    intervalSeconds: 3600,
  }) as unknown as TimeSeries;

const deferredReader = () => {
  const pending = new Map<number, (series: TimeSeries) => void>();
  const reader = {
    timestepCount: 2,
    getTimeSeries: (assetId: number) =>
      new Promise<TimeSeries>((resolve) => pending.set(assetId, resolve)),
  };
  const resolve = async (assetId: number, series: TimeSeries) => {
    await act(async () => {
      pending.get(assetId)!(series);
      await Promise.resolve();
    });
  };
  return { reader, resolve };
};

const renderFor = (reader: unknown, assetId: number) => {
  const store = setInitialState({
    simulation: {
      status: "success",
      report: "",
      modelVersion: "",
      settingsVersion: "",
      epsResultsReader: reader,
    } as unknown as SimulationState,
  });
  return renderHook(
    ({ id }: { id: number }) =>
      useTimeSeries({
        assetId: id,
        assetType: "junction",
        property: "pressure",
      }),
    {
      initialProps: { id: assetId },
      wrapper: ({ children }) => <Provider store={store}>{children}</Provider>,
    },
  );
};

describe("useTimeSeries", () => {
  it("keeps the selected asset's series when an earlier request finishes last", async () => {
    const { reader, resolve } = deferredReader();
    const { result, rerender } = renderFor(reader, 1);

    rerender({ id: 2 });
    await resolve(2, seriesOf(20));
    await resolve(1, seriesOf(10));

    expect(result.current.data?.values[0]).toEqual(20);
    expect(result.current.isLoading).toBe(false);
  });

  it("reports loading as soon as the asset changes", async () => {
    const { reader, resolve } = deferredReader();
    const { result, rerender } = renderFor(reader, 1);
    await resolve(1, seriesOf(10));

    rerender({ id: 2 });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.isStale).toBe(true);
  });
});
