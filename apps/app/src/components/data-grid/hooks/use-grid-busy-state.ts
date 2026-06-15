import { useCallback, useMemo, useState, useTransition } from "react";
import type { GridBusyApi } from "../shared/grid-busy";

const runAfterPaint = (cb: () => void): void => {
  requestAnimationFrame(() => requestAnimationFrame(cb));
};

export type GridBusyState = {
  isBusy: boolean;
  busyApi: GridBusyApi;
};

export function useGridBusyState(): GridBusyState {
  const [isPending, startBusyTransition] = useTransition();
  const [isManualBusy, setIsManualBusy] = useState(false);
  const isBusy = isPending || isManualBusy;

  const runBusy = useCallback(
    (operation: () => void) => startBusyTransition(operation),
    [],
  );

  const runBusyAsync = useCallback((operation: () => Promise<void> | void) => {
    setIsManualBusy(true);
    runAfterPaint(() => {
      void (async () => {
        try {
          await operation();
        } finally {
          setIsManualBusy(false);
        }
      })();
    });
  }, []);

  const busyApi = useMemo<GridBusyApi>(
    () => ({ runBusy, runBusyAsync }),
    [runBusy, runBusyAsync],
  );

  return { isBusy, busyApi };
}
