import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { filterLockedFeatures } from "src/lib/folder";
import { dataAtom, selectionAtom, stagingModelAtom } from "src/state/jotai";

export const selectAllShortcut = "ctrl+a";

export const useSelectAll = () => {
  const userTracking = useUserTracking();
  const setSelection = useSetAtom(selectionAtom);
  const hydraulicModel = useAtomValue(stagingModelAtom);
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
