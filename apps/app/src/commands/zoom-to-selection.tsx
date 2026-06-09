import { useAtomValue } from "jotai";
import { useCallback } from "react";
import { useZoomTo } from "src/hooks/use-zoom-to";
import { useUserTracking } from "src/infra/user-tracking";
import { USelection } from "src/selection";
import { selectionAtom } from "src/state/selection";

type Source = "toolbar" | "context-menu";

export const useZoomToSelection = () => {
  const selection = useAtomValue(selectionAtom);
  const zoomTo = useZoomTo();
  const userTracking = useUserTracking();

  return useCallback(
    ({ source }: { source: Source }) => {
      const { assets, customerPoints } = USelection.countByKind(selection);
      userTracking.capture({
        name: "selection.zoomedTo",
        source,
        count: assets + customerPoints,
        description: USelection.describe(selection),
      });
      zoomTo(selection);
    },
    [selection, zoomTo, userTracking],
  );
};
