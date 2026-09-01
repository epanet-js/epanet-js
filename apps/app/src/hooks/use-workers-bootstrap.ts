import { useEffect, useRef, useState } from "react";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { configureLongLivedWorkers } from "src/infra/long-lived-workers";
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

export const useWorkersBootstrap = (areFeatureFlagsReady: boolean): boolean => {
  const [areWorkersReady, setAreWorkersReady] = useState(false);
  const isLongLivedWorkersOn = useFeatureFlag("FLAG_LONG_LIVED_WORKERS");
  const workersInitializedRef = useRef(false);

  useEffect(() => {
    if (workersInitializedRef.current) return;
    if (!areFeatureFlagsReady) return;
    workersInitializedRef.current = true;

    const bootstrap = async () => {
      configureLongLivedWorkers(isLongLivedWorkersOn);
      if (!isLongLivedWorkersOn) return;
      try {
        const preloadedWorkers = [
          preloadSimulationWorker(),
          preloadTraceWorker(),
        ];
        await Promise.all(preloadedWorkers);
      } catch (error) {
        captureError(error as Error);
      }
    };

    void bootstrap().finally(() => {
      setAreWorkersReady(true);
    });
  }, [areFeatureFlagsReady, isLongLivedWorkersOn]);

  return areWorkersReady;
};
