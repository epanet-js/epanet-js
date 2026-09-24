import { useEffect, useRef, useState } from "react";
import { captureError } from "src/infra/error-tracking";
import { canUseWorker } from "src/infra/worker";

const preloadSimulationWorker = async (): Promise<void> => {
  const { lib } = await import("src/lib/worker");
  await lib.warmupSimulationEngine();
};

const preloadTraceWorker = async (): Promise<void> => {
  if (!canUseWorker()) return;
  const { getTraceWorker } = await import("src/lib/trace/get-worker");
  getTraceWorker();
};

const preloadConnectivityTraceWorker = async (): Promise<void> => {
  if (!canUseWorker()) return;
  const { getConnectivityTraceWorker } = await import(
    "src/lib/network-review/connectivity-trace/get-worker"
  );
  getConnectivityTraceWorker();
};

const preloadOrphanAssetsWorker = async (): Promise<void> => {
  if (!canUseWorker()) return;
  const { getOrphanAssetsWorker } = await import(
    "src/lib/network-review/orphan-assets/get-worker"
  );
  getOrphanAssetsWorker();
};

const preloadCustomerPointsWorker = async (): Promise<void> => {
  if (!canUseWorker()) return;
  const { getCustomerPointsWorker } = await import(
    "src/lib/customer-points/get-worker"
  );
  getCustomerPointsWorker();
};

const preloadCrossingPipesWorker = async (): Promise<void> => {
  if (!canUseWorker()) return;
  const { getCrossingPipesWorker } = await import(
    "src/lib/network-review/crossing-pipes/get-worker"
  );
  getCrossingPipesWorker();
};

const preloadProximityAnomaliesWorker = async (): Promise<void> => {
  if (!canUseWorker()) return;
  const { getProximityAnomaliesWorker } = await import(
    "src/lib/network-review/proximity-anomalies/get-worker"
  );
  getProximityAnomaliesWorker();
};

const preloadSpatialQueryWorker = async (): Promise<void> => {
  if (!canUseWorker()) return;
  const { getSpatialQueryWorker } = await import(
    "src/map/mode-handlers/area-selection/get-worker"
  );
  getSpatialQueryWorker();
};

export const useWorkersBootstrap = (areFeatureFlagsReady: boolean): boolean => {
  const [areWorkersReady, setAreWorkersReady] = useState(false);
  const workersInitializedRef = useRef(false);

  useEffect(() => {
    if (workersInitializedRef.current) return;
    if (!areFeatureFlagsReady) return;
    workersInitializedRef.current = true;

    const bootstrap = async () => {
      try {
        await Promise.all([
          preloadSimulationWorker(),
          preloadTraceWorker(),
          preloadConnectivityTraceWorker(),
          preloadOrphanAssetsWorker(),
          preloadCustomerPointsWorker(),
          preloadCrossingPipesWorker(),
          preloadProximityAnomaliesWorker(),
          preloadSpatialQueryWorker(),
        ]);
      } catch (error) {
        captureError(error as Error);
      }
    };

    void bootstrap().finally(() => {
      setAreWorkersReady(true);
    });
  }, [areFeatureFlagsReady]);

  return areWorkersReady;
};
