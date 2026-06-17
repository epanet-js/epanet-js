import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { customerPointsVisibleAtom } from "src/state/map-symbology";
import { USelection } from "src/selection";

export const selectAllShortcut = "ctrl+a";

export const useSelectAll = () => {
  const userTracking = useUserTracking();
  const setSelection = useSetAtom(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const customerPointsVisible = useAtomValue(customerPointsVisibleAtom);

  return useCallback(
    ({ source }: { source: "shortcut" }) => {
      userTracking.capture({
        name: "fullSelection.enabled",
        source,
        count: hydraulicModel.assets.size,
      });

      const assetIds = Array.from(hydraulicModel.assets.keys());
      const customerPointIds = customerPointsVisible
        ? Array.from(hydraulicModel.customerPoints.keys())
        : [];
      setSelection(USelection.fromIds(assetIds, customerPointIds));
    },
    [userTracking, setSelection, hydraulicModel, customerPointsVisible],
  );
};
