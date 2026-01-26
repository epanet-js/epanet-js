import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { simulationAtom } from "src/state/jotai";
import { OPFSStorage } from "src/infra/storage/opfs-storage";
import {
  EPSResultsReader,
  TimeSeries,
} from "src/simulation/epanet/eps-results-reader";
import { getAppId } from "src/infra/app-instance";
import { captureError } from "src/infra/error-tracking";
import type {
  QuickGraphAssetType,
  QuickGraphPropertyByAssetType,
} from "src/state/quick-graph";
import { worktreeAtom } from "src/state/scenarios";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

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
  const isScenariosOn = useFeatureFlag("FLAG_SCENARIOS");
  const [data, setData] = useState<TimeSeries | null>(null);
  const [mainData, setMainData] = useState<TimeSeries | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    return simulation.status === "success" || simulation.status === "warning";
  });
  const abortControllerRef = useRef<AbortController | null>(null);

  const isInScenario =
    isScenariosOn && worktree.activeSnapshotId !== worktree.mainId;
  const mainSnapshot = worktree.snapshots.get(worktree.mainId);
  const mainSimulation = mainSnapshot?.simulation ?? null;

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
        const appId = getAppId();
        const scenarioKey = isScenariosOn
          ? worktree.activeSnapshotId
          : undefined;
        const storage = new OPFSStorage(appId, scenarioKey);
        const epsReader = new EPSResultsReader(storage);
        await epsReader.initialize(metadata, simulationIds);

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
          mainSimulation &&
          (mainSimulation.status === "success" ||
            mainSimulation.status === "warning") &&
          mainSimulation.metadata &&
          mainSimulation.simulationIds
        ) {
          try {
            const mainStorage = new OPFSStorage(appId, "main");
            const mainReader = new EPSResultsReader(mainStorage);
            await mainReader.initialize(
              mainSimulation.metadata,
              mainSimulation.simulationIds,
            );

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
    isScenariosOn,
    worktree.activeSnapshotId,
    isInScenario,
    mainSimulation,
  ]);

  return { data, mainData, isLoading };
}
