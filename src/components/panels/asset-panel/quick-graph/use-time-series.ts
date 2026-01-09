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
  const [data, setData] = useState<TimeSeries | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (simulation.status === "failure") {
      setData(null);
      setIsLoading(false);
      return;
    }

    if (simulation.status !== "success" && simulation.status !== "warning") {
      return;
    }

    const { metadata, simulationIds } = simulation;
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
        const storage = new OPFSStorage(appId);
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
  }, [assetId, assetType, property, simulation]);

  return { data, isLoading };
}
