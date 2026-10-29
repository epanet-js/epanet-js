import { useAtomCallback } from "jotai/utils";
import type { LngLatBoundsLike } from "mapbox-gl";
import { useCallback, useContext } from "react";
import { useZoomTo } from "src/hooks/use-zoom-to";
import type { ScriptBookmark, ScriptSelectionSet } from "src/lib/scripting";
import { existingSelection } from "src/lib/collections";
import { MapContext } from "src/map";
import { USelection } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { selectionAtom } from "src/state/selection";

export const useApplyScriptSelectionSet = () => {
  const zoomTo = useZoomTo();

  return useAtomCallback(
    useCallback(
      (get, set, { targets }: ScriptSelectionSet) => {
        const selection = existingSelection(
          USelection.fromIds(targets.assetIds, targets.customerPointIds),
          get(stagingModelDerivedAtom),
        );
        set(selectionAtom, selection);
        zoomTo(selection);
      },
      [zoomTo],
    ),
  );
};

export const useGoToScriptBookmark = () => {
  const map = useContext(MapContext);

  return useCallback(
    ({ bbox }: ScriptBookmark) => {
      map?.map.fitBounds(bbox as LngLatBoundsLike, {
        padding: 0,
        animate: false,
      });
    },
    [map],
  );
};
