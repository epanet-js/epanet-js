import { useEffect, useRef, useState } from "react";
import { captureError } from "src/infra/error-tracking";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

const preloadSimulationWorker = async (): Promise<void> => {
  const { lib } = await import("src/lib/worker");
  await lib.configureWorkerReuse(true);
  await lib.warmupSimulationEngine();
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
      if (!isLongLivedWorkersOn) return;
      try {
        const preloadedWorkers = [preloadSimulationWorker()];
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
