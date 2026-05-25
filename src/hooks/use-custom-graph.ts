import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useTranslate } from "src/hooks/use-translate";
import { usePermissions } from "src/hooks/use-permissions";
import { useShowPriorityAccessDialog } from "src/hooks/use-priority-access";
import { useUserTracking } from "src/infra/user-tracking";
import { selectedFeaturesDerivedAtom } from "src/state/derived-branch-state";

export const useCustomGraph = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const translate = useTranslate();
  const { canUseCustomGraphs } = usePermissions();
  const showPriorityAccess = useShowPriorityAccessDialog();
  const { capture } = useUserTracking();
  const selectedWrappedFeatures = useAtomValue(selectedFeaturesDerivedAtom);

  const openCustomGraph = useCallback(() => {
    capture({
      name: "customGraph.opened",
      numAssets: selectedWrappedFeatures.length,
      canUseCustomGraphs,
    });

    if (!canUseCustomGraphs) {
      showPriorityAccess({
        featureName: translate("customGraph.titlePlural"),
      });
      return Promise.resolve();
    }

    setDialogState({ type: "customGraph" });
    return Promise.resolve();
  }, [
    canUseCustomGraphs,
    showPriorityAccess,
    translate,
    capture,
    selectedWrappedFeatures,
    setDialogState,
  ]);

  return { openCustomGraph };
};
