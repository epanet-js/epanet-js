import { useCallback } from "react";
import { useSetAtom, useAtomValue } from "jotai";
import { dialogAtom } from "src/state/dialog";
import { useUserTracking } from "src/infra/user-tracking";
import { selectedAssetsDerivedAtom } from "src/state/derived-branch-state";

export const useCustomGraph = () => {
  const setDialogState = useSetAtom(dialogAtom);
  const { capture } = useUserTracking();
  const selectedWrappedFeatures = useAtomValue(selectedAssetsDerivedAtom);

  const openCustomGraph = useCallback(() => {
    capture({
      name: "customGraph.opened",
      numAssets: selectedWrappedFeatures.length,
      canUseCustomGraphs: true,
    });

    setDialogState({ type: "customGraph" });
    return Promise.resolve();
  }, [capture, selectedWrappedFeatures, setDialogState]);

  return { openCustomGraph };
};
