import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useUserTracking } from "src/infra/user-tracking";
import { filterLockedFeatures } from "src/lib/folder";
import { dataAtom, selectionAtom } from "src/state/jotai";

export const selectAllShortcut = "ctrl+a";

export const useSelectAll = () => {
  const userTracking = useUserTracking();
  const setSelection = useSetAtom(selectionAtom);
  const data = useAtomValue(dataAtom);

  const selectAll = useCallback(
    ({ source }: { source: "shortcut" }) => {
      userTracking.capture({
        name: "fullSelection.enabled",
        source,
      });

      setSelection({
        type: "multi",
        ids: filterLockedFeatures(data).map((f) => f.id),
      });
    },
    [userTracking, setSelection, data],
  );

  return selectAll;
};
