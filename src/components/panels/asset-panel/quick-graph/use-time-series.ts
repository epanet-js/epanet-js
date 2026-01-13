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
import { scenariosAtom } from "src/state/scenarios";

interface UseTimeSeriesOptions<T extends QuickGraphAssetType> {
  assetId: number;
  assetType: T;
  property: QuickGraphPropertyByAssetType[T];
}

interface UseTimeSeriesResult {
  data: TimeSeries | null;
  isLoading: boolean;
}

export function useTimeSeries<T extends QuickGraphAssetType>({
  assetId,
  assetType,
  property,
}: UseTimeSeriesOptions<T>): UseTimeSeriesResult {
  const simulation = useAtomValue(simulationAtom);
  const scenariosState = useAtomValue(scenariosAtom);
  const [data, setData] = useState<TimeSeries | null>(null);
  const [isLoading, setIsLoading] = useState(() => {
    return simulation.status === "success" || simulation.status === "warning";
  });
  const abortControllerRef = useRef<AbortController | null>(null);

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
        const scenarioKey = scenariosState.activeScenarioId ?? "main";
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
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        const error = err as Error;
        captureError(error);
        setData(null);
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
    scenariosState.activeScenarioId,
  ]);

  return { data, isLoading };
}
