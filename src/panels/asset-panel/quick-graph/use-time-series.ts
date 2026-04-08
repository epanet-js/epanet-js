import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { simulationAtom } from "src/state/simulation";
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
  mainData: TimeSeries | null;
  isLoading: boolean;
}

export function useTimeSeries<T extends QuickGraphAssetType>({
  assetId,
  assetType,
  property,
}: UseTimeSeriesOptions<T>): UseTimeSeriesResult {
  const simulation = useAtomValue(simulationAtom);
  const worktree = useAtomValue(worktreeAtom);
  const [data, setData] = useState<TimeSeries | null>(null);
  const [mainData, setMainData] = useState<TimeSeries | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    return simulation.status === "success" || simulation.status === "warning";
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const epsResultsReader =
    simulation.status === "success" || simulation.status === "warning"
      ? simulation.epsResultsReader
      : undefined;

  const isInScenario = worktree.activeSnapshotId !== worktree.mainId;
  const mainSnapshot = worktree.snapshots.get(worktree.mainId);
  const mainSimulation = mainSnapshot?.simulation ?? null;
  const mainEpsResultsReader =
    mainSimulation &&
    (mainSimulation.status === "success" || mainSimulation.status === "warning")
      ? mainSimulation.epsResultsReader
      : undefined;

  useEffect(() => {
    if (simulation.status === "failure") {
      setData(null);
      setMainData(null);
      setIsLoading(false);
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

        if (isInScenario && mainEpsResultsReader) {
          try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mainResult = await mainEpsResultsReader.getTimeSeries(
              assetId,
              assetType as any,
              property as any,
            );

            if (abortControllerRef.current?.signal.aborted) {
              return;
            }
            setMainData(mainResult);
          } catch {
            setMainData(null);
          }
        } else {
          setMainData(null);
        }
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        const error = err as Error;
        captureError(error);
        setData(null);
        setMainData(null);
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
    simulation.status,
    epsResultsReader,
    isInScenario,
    mainEpsResultsReader,
  ]);

  return { data, mainData, isLoading };
}
