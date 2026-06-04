import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";
import { USelection } from "src/selection";

export const selectAllShortcut = "ctrl+a";

export const useSelectAll = () => {
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
        USelection.fromIds(Array.from(hydraulicModel.assets.keys())),
      );
    },
    [userTracking, setSelection, hydraulicModel],
  );

  return selectAll;
};
