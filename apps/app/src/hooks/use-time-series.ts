import { useState, useEffect } from "react";
import { useAtomValue } from "jotai";
import {
  simulationDerivedAtom,
  baseSimulationDerivedAtom,
} from "src/state/derived-branch-state";
import type {
  EPSResultsReader,
  TimeSeries,
} from "src/simulation/epanet/eps-results-reader";
import { captureError } from "src/infra/error-tracking";
import type {
  QuickGraphAssetType,
  QuickGraphPropertyByAssetType,
} from "src/lib/asset-graph";
import { worktreeAtom } from "src/state/scenarios";

interface UseTimeSeriesOptions<T extends QuickGraphAssetType> {
  assetId: number;
  assetType: T;
  property: QuickGraphPropertyByAssetType[T];
}

interface UseTimeSeriesResult {
  data: TimeSeries | null;
  baseData: TimeSeries | null;
  isLoading: boolean;
  isStale: boolean;
}

type LoadedSeries = {
  key: string;
  reader: EPSResultsReader;
  baseReader: EPSResultsReader | null;
  data: TimeSeries | null;
  baseData: TimeSeries | null;
};

export function useTimeSeries<T extends QuickGraphAssetType>({
  assetId,
  assetType,
  property,
}: UseTimeSeriesOptions<T>): UseTimeSeriesResult {
  const simulation = useAtomValue(simulationDerivedAtom);
  const worktree = useAtomValue(worktreeAtom);
  const baseSimulation = useAtomValue(baseSimulationDerivedAtom);
  const [loaded, setLoaded] = useState<LoadedSeries | null>(null);

  const isInScenario = worktree.activeBranchId !== worktree.mainId;
  const baseEpsResultsReader =
    baseSimulation && "epsResultsReader" in baseSimulation
      ? (baseSimulation.epsResultsReader ?? null)
      : null;
  const baseReader = isInScenario ? baseEpsResultsReader : null;

  const status = simulation.status;
  const epsResultsReader =
    "epsResultsReader" in simulation
      ? (simulation.epsResultsReader ?? null)
      : null;
  const reader =
    status === "success" || status === "warning" ? epsResultsReader : null;

  const key = `${assetType}:${assetId}:${property}`;

  useEffect(
    function fetchTimeSeries() {
      if (!reader) return;
      const controller = new AbortController();

      const fetchSeries = async () => {
        let data: TimeSeries | null = null;
        let baseData: TimeSeries | null = null;
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          data = await reader.getTimeSeries(
            assetId,
            assetType as any,
            property as any,
          );
          if (controller.signal.aborted) return;

          if (baseReader) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              baseData = await baseReader.getTimeSeries(
                assetId,
                assetType as any,
                property as any,
              );
            } catch {
              baseData = null;
            }
          }
        } catch (err) {
          if (controller.signal.aborted) return;
          captureError(err as Error);
          data = null;
          baseData = null;
        }
        if (controller.signal.aborted) return;
        setLoaded({ key, reader, baseReader, data, baseData });
      };

      void fetchSeries();
      return () => controller.abort();
    },
    [key, assetId, assetType, property, reader, baseReader],
  );

  if (status === "failure") {
    return { data: null, baseData: null, isLoading: false, isStale: false };
  }

  const isCurrent = loaded?.key === key;
  const isLoading =
    reader !== null &&
    !(
      isCurrent &&
      loaded.reader === reader &&
      loaded.baseReader === baseReader
    );

  return {
    data: loaded?.data ?? null,
    baseData: loaded?.baseData ?? null,
    isLoading,
    isStale: loaded !== null && !isCurrent,
  };
}
