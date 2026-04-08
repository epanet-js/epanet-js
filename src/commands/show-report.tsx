import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { useUserTracking } from "src/infra/user-tracking";
import { simulationDerivedAtom } from "src/state/derived-branch-state";
import { dialogAtom } from "src/state/dialog";
import { simulationAtom } from "src/state/simulation";

export const showReportShorcut = "alt+r";

export const useShowReport = () => {
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");
  const setDialogState = useSetAtom(dialogAtom);
  const userTracking = useUserTracking();
  const simulation = useAtomValue(
    isStateRefactorOn ? simulationDerivedAtom : simulationAtom,
  );

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
