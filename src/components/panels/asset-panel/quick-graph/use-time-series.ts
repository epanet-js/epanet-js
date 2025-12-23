import { useState, useEffect, useRef } from "react";
import { useAtomValue } from "jotai";
import { simulationAtom } from "src/state/jotai";
import { OPFSStorage } from "src/infra/storage/opfs-storage";
import {
  EPSResultsReader,
  TimeSeries,
  NodeProperty,
  LinkProperty,
} from "src/simulation/epanet/eps-results-reader";
import { getAppId } from "src/infra/app-instance";
import { captureError } from "src/infra/error-tracking";
import type { QuickGraphProperty, AssetType } from "src/state/quick-graph";

interface UseTimeSeriesOptions {
  assetId: number;
  assetType: AssetType;
  property: QuickGraphProperty;
}

interface UseTimeSeriesResult {
  data: TimeSeries | null;
  isLoading: boolean;
  error: Error | null;
}

// Simple cache to avoid re-fetching the same data
const cache = new Map<string, TimeSeries>();

function getCacheKey(
  assetId: number,
  property: QuickGraphProperty,
  modelVersion: string,
): string {
  return `${modelVersion}:${assetId}:${property}`;
}

export function useTimeSeries({
  assetId,
  assetType,
  property,
}: UseTimeSeriesOptions): UseTimeSeriesResult {
  const simulation = useAtomValue(simulationAtom);
  const [data, setData] = useState<TimeSeries | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Only fetch if simulation has finished successfully
    if (simulation.status !== "success" && simulation.status !== "warning") {
      setData(null);
      setIsLoading(false);
      setError(null);
      return;
    }

    const { metadata, simulationIds, modelVersion } = simulation;
    if (!metadata || !simulationIds || !modelVersion) {
      return;
    }

    // Check cache first
    const cacheKey = getCacheKey(assetId, property, modelVersion);
    const cachedData = cache.get(cacheKey);
    if (cachedData) {
      setData(cachedData);
      setIsLoading(false);
      setError(null);
      return;
    }

    // Cancel any previous fetch
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const fetchTimeSeries = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const appId = getAppId();
        const storage = new OPFSStorage(appId);
        const epsReader = new EPSResultsReader(storage);
        await epsReader.initialize(metadata, simulationIds);

        let result: TimeSeries | null = null;

        // Determine which method to call based on asset type and property
        if (assetType === "junction" || assetType === "reservoir") {
          // Node assets using node properties
          const nodeProperty = property as NodeProperty;
          result = await epsReader.getNodeTimeSeries(assetId, nodeProperty);
        } else if (assetType === "tank") {
          // Tanks can have node properties or volume
          if (property === "volume") {
            result = await epsReader.getTankVolumeTimeSeries(assetId);
          } else if (property === "level") {
            // Level is stored as "pressure" in the results
            result = await epsReader.getNodeTimeSeries(assetId, "pressure");
          } else {
            const nodeProperty = property as NodeProperty;
            result = await epsReader.getNodeTimeSeries(assetId, nodeProperty);
          }
        } else {
          // Link assets (pipe, pump, valve)
          const linkProperty = property as LinkProperty;
          result = await epsReader.getLinkTimeSeries(assetId, linkProperty);
        }

        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        if (result) {
          // Cache the result
          cache.set(cacheKey, result);
          setData(result);
        } else {
          // eslint-disable-next-line no-console
          console.error(
            "Quick graph: No data found",
            { assetId, assetType, property },
            "Available node IDs:",
            Array.from(simulationIds.nodeIdToIndex.keys()).slice(0, 5),
            "Available link IDs:",
            Array.from(simulationIds.linkIdToIndex.keys()).slice(0, 5),
          );
          setError(new Error("No data found for this asset"));
        }
      } catch (err) {
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }
        const error = err as Error;
        // eslint-disable-next-line no-console
        console.error("Quick graph error:", error.message, error.stack);
        captureError(error);
        setError(error);
      } finally {
        setIsLoading(false);
      }
    };

    void fetchTimeSeries();

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [assetId, assetType, property, simulation]);

  return { data, isLoading, error };
}

// Clear cache when needed (e.g., when simulation is re-run)
export function clearTimeSeriesCache(): void {
  cache.clear();
}
