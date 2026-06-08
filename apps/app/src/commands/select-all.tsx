import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";
import { useFeatureFlag } from "src/hooks/use-feature-flags";

export const selectAllShortcut = "ctrl+a";

export const useSelectAll = () => {
  const isMultiCpSelectionOn = useFeatureFlag("FLAG_MULTI_CP_SELECTION");
  const selectAllNew = useSelectAllNew();
  const selectAllDeprecated = useSelectAllDeprecated();
  return isMultiCpSelectionOn ? selectAllNew : selectAllDeprecated;
};

const useSelectAllDeprecated = () => {
  const userTracking = useUserTracking();
  const setSelection = useSetAtom(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  const selectAll = useCallback(
    ({ source }: { source: "shortcut" }) => {
      userTracking.capture({
        name: "fullSelection.enabled",
        source,
        count: hydraulicModel.assets.size,
      });

      setSelection(
        USelection.fromAssetIds(Array.from(hydraulicModel.assets.keys())),
      );
    },
    [userTracking, setSelection, hydraulicModel],
  );

  return selectAll;
};

const useSelectAllNew = () => {
  const userTracking = useUserTracking();
  const setSelection = useSetAtom(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);

  return useCallback(
    ({ source }: { source: "shortcut" }) => {
      userTracking.capture({
        name: "fullSelection.enabled",
        source,
        count: hydraulicModel.assets.size,
      });

      const assetIds = Array.from(hydraulicModel.assets.keys());
      const customerPointIds = Array.from(hydraulicModel.customerPoints.keys());
      setSelection(USelection.fromKindedIds(assetIds, customerPointIds));
    },
    [userTracking, setSelection, hydraulicModel],
  );
};
