import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { filterLockedFeatures } from "src/lib/folder";
import { dataAtom } from "src/state/data";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";

export const selectAllShortcut = "ctrl+a";

export const useSelectAll = () => {
  const userTracking = useUserTracking();
  const setSelection = useSetAtom(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelDerivedAtom);
  const { folderMap } = useAtomValue(dataAtom);

  const selectAll = useCallback(
    ({ source }: { source: "shortcut" }) => {
      userTracking.capture({
        name: "fullSelection.enabled",
        source,
        count: hydraulicModel.assets.size,
      });

      setSelection({
        type: "multi",
        ids: filterLockedFeatures({ hydraulicModel, folderMap }).map(
          (f) => f.id,
        ),
      });
    },
    [userTracking, setSelection, hydraulicModel, folderMap],
  );

  return selectAll;
};
