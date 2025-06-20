import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { dialogAtom } from "src/state/dialog";
import { simulationAtom } from "src/state/jotai";

export const showReportShorcut = "alt+r";

export const useShowReport = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const simulation = useAtomValue(simulationAtom);

  const showReport = useCallback(
    ({ source }: { source: "toolbar" | "resultDialog" | "shortcut" }) => {
      userTracking.capture({
        name: "report.opened",
        source,
        status: simulation.status,
      });
      setDialogState({ type: "simulationReport" });
    },
    [setDialogState, userTracking, simulation],
  );

  return showReport;
};
