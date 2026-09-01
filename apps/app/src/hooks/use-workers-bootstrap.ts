import { useEffect, useRef, useState } from "react";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import {
  configureLongLivedWorkers,
  configureFullOfflineSupport,
} from "src/infra/long-lived-workers";
import { canUseWorker } from "src/infra/worker";

const preloadSimulationWorker = async (): Promise<void> => {
  const { lib } = await import("src/lib/worker");
  await lib.configureWorkerReuse(true);
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

export const useWorkersBootstrap = (areFeatureFlagsReady: boolean): boolean => {
  const [areWorkersReady, setAreWorkersReady] = useState(false);
  const isLongLivedWorkersOn = useFeatureFlag("FLAG_LONG_LIVED_WORKERS");
  const isFullOfflineSupportOn = useFeatureFlag("FLAG_FULL_OFFLINE_SUPPORT");
  const workersInitializedRef = useRef(false);

  useEffect(() => {
    if (workersInitializedRef.current) return;
    if (!areFeatureFlagsReady) return;
    workersInitializedRef.current = true;

    const bootstrap = async () => {
      configureLongLivedWorkers(isLongLivedWorkersOn);
      if (!isLongLivedWorkersOn) return;
      configureFullOfflineSupport(isFullOfflineSupportOn);
      try {
        const nextPreloadedWorkers = isFullOfflineSupportOn
          ? [preloadCustomerPointsWorker()]
          : [];
        const preloadedWorkers = [
          preloadSimulationWorker(),
          preloadTraceWorker(),
          preloadConnectivityTraceWorker(),
          preloadOrphanAssetsWorker(),
        ];
        await Promise.all([...preloadedWorkers, ...nextPreloadedWorkers]);
      } catch (error) {
        captureError(error as Error);
      }
    };

    void bootstrap().finally(() => {
      setAreWorkersReady(true);
    });
  }, [areFeatureFlagsReady, isLongLivedWorkersOn, isFullOfflineSupportOn]);

  return areWorkersReady;
};
