import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import {
  simulationDerivedAtom,
  baseSimulationDerivedAtom,
} from "src/state/derived-branch-state";
import { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import { captureError } from "src/infra/error-tracking";
import type {
  QuickGraphAssetType,
  QuickGraphPropertyByAssetType,
} from "src/state/quick-graph";
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
}

export function useTimeSeries<T extends QuickGraphAssetType>({
  assetId,
  assetType,
  property,
}: UseTimeSeriesOptions<T>): UseTimeSeriesResult {
  const simulation = useAtomValue(simulationDerivedAtom);
  const worktree = useAtomValue(worktreeAtom);
  const baseSimulationDerived = useAtomValue(baseSimulationDerivedAtom);
  const [data, setData] = useState<TimeSeries | null>(null);
  const [baseData, setBaseData] = useState<TimeSeries | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    return simulation.status === "success" || simulation.status === "warning";
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const isInScenario = worktree.activeBranchId !== worktree.mainId;
  const baseSimulation = baseSimulationDerived;
  const baseStatus = baseSimulation?.status;
  const baseEpsResultsReader =
    baseSimulation && "epsResultsReader" in baseSimulation
      ? baseSimulation.epsResultsReader
      : null;

  const status = simulation.status;
  const epsResultsReader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : null;

  useEffect(() => {
    if (status === "failure") {
      setData(null);
      setBaseData(null);
      setIsLoading(false);
      return;
    }

    if (status !== "success" && status !== "warning") {
      return;
    }

    if (!epsResultsReader) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const fetchTimeSeries = async () => {
      setIsLoading(true);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await epsResultsReader.getTimeSeries(
          assetId,
          assetType as any,
          property as any,
        );

        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        setData(result);

        if (isInScenario && baseEpsResultsReader) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const baseResult = await baseEpsResultsReader.getTimeSeries(
              assetId,
              assetType as any,
              property as any,
            );

            if (abortControllerRef.current?.signal.aborted) {
              return;
            }
            setBaseData(baseResult);
          } catch {
            setBaseData(null);
          }
        } else {
          setBaseData(null);
        }
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        const error = err as Error;
        captureError(error);
        setData(null);
        setBaseData(null);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchTimeSeries();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [
    assetId,
    assetType,
    property,
    status,
    isInScenario,
    baseStatus,
    epsResultsReader,
    baseEpsResultsReader,
  ]);

  return { data, baseData, isLoading };
}
