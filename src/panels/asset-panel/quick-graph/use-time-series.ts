import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { simulationAtom } from "src/state/simulation";
import { OPFSStorage } from "src/infra/storage/opfs-storage";
import {
  EPSResultsReader,
  TimeSeries,
} from "src/simulation/epanet/eps-results-reader";
import { getAppId } from "src/infra/app-instance";
import { captureError } from "src/infra/error-tracking";
import { useGetEpsResultsReader } from "src/hooks/use-eps-results-reader";
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
  const simulation = useAtomValue(simulationAtom);
  const worktree = useAtomValue(worktreeAtom);
  const getEpsResultsReader = useGetEpsResultsReader();
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
  const mainMetadata =
    mainSimulation &&
    (mainSimulation.status === "success" || mainSimulation.status === "warning")
      ? mainSimulation.metadata
      : undefined;
  const mainSimulationIds =
    mainSimulation &&
    (mainSimulation.status === "success" || mainSimulation.status === "warning")
      ? mainSimulation.simulationIds
      : undefined;

  const status = simulation.status;
  const metadata =
    status === "success" || status === "warning"
      ? simulation.metadata
      : undefined;
  const simulationIds =
    status === "success" || status === "warning"
      ? simulation.simulationIds
      : undefined;

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

    if (!metadata || !simulationIds) {
      return;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const fetchTimeSeries = async () => {
      setIsLoading(true);

      try {
        const epsReader = await getEpsResultsReader();
        if (!epsReader) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await epsReader.getTimeSeries(
          assetId,
          assetType as any,
          property as any,
        );

        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        setData(result);

        if (
          isInScenario &&
          (mainStatus === "success" || mainStatus === "warning") &&
          mainMetadata &&
          mainSimulationIds
        ) {
          try {
            const mainStorage = new OPFSStorage(getAppId(), "main");
            const mainReader = new EPSResultsReader(mainStorage);
            await mainReader.initialize(mainMetadata, mainSimulationIds);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mainResult = await mainReader.getTimeSeries(
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
    metadata,
    simulationIds,
    getEpsResultsReader,
    isInScenario,
    mainStatus,
    mainMetadata,
    mainSimulationIds,
  ]);

  return { data, mainData, isLoading };
}
