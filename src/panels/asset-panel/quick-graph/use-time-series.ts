import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { simulationAtom } from "src/state/simulation";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { TimeSeries } from "src/simulation/epanet/eps-results-reader";
import { captureError } from "src/infra/error-tracking";
import type {
  QuickGraphAssetType,
  QuickGraphPropertyByAssetType,
} from "src/state/quick-graph";
import { worktreeAtom } from "src/state/scenarios";
import { branchStateAtom } from "src/state/branch-state";

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
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const simulation = useAtomValue(
    isStateRefactorOn ? simulationDerivedAtom : simulationAtom,
  );
  const worktree = useAtomValue(worktreeAtom);
  const branchStates = useAtomValue(branchStateAtom);
  const [data, setData] = useState<TimeSeries | null>(null);
  const [mainData, setMainData] = useState<TimeSeries | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    return simulation.status === "success" || simulation.status === "warning";
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const isInScenario = worktree.activeSnapshotId !== worktree.mainId;
  const mainBranchState = branchStates.get(worktree.mainId);
  const mainSimulation =
    mainBranchState?.simulation ??
    worktree.snapshots.get(worktree.mainId)?.simulation ??
    null;
  const mainStatus = mainSimulation?.status;
  const mainEpsResultsReader =
    mainSimulation && "epsResultsReader" in mainSimulation
      ? mainSimulation.epsResultsReader
      : null;

  const status = simulation.status;
  const epsResultsReader =
    "epsResultsReader" in simulation ? simulation.epsResultsReader : null;

  useEffect(() => {
    if (status === "failure") {
      setData(null);
      setMainData(null);
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
    status,
    isInScenario,
    mainStatus,
    epsResultsReader,
    mainEpsResultsReader,
  ]);

  return { data, mainData, isLoading };
}
