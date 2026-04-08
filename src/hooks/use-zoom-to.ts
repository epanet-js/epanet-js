import { MapContext } from "src/map";
import { useAtomCallback } from "jotai/utils";
import { getExtent, isBBoxEmpty } from "src/lib/geometry";
import { LngLatBoundsLike } from "mapbox-gl";
import { Maybe } from "purify-ts/Maybe";
import { useCallback, useContext } from "react";
import { USelection } from "src/selection";
import type { Sel } from "src/selection/types";
import { dataAtom } from "src/state/data";
import { stagingModelAtom } from "src/state/hydraulic-model";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { BBox, FeatureCollection, IWrappedFeature } from "src/types";

export function useZoomTo() {
  const map = useContext(MapContext);
  const isStateRefactorOn = useFeatureFlag("FLAG_STATE_REFACTOR");

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        selection: Sel | IWrappedFeature[] | Maybe<BBox>,
        maxZoom?: number,
      ) => {
        const data = get(dataAtom);
        const hydraulicModel = get(
          isStateRefactorOn ? stagingModelDerivedAtom : stagingModelAtom,
        );
        let extent: Maybe<BBox>;
        if (Maybe.isMaybe(selection)) {
          extent = selection;
        } else {
          const selectedFeatures: FeatureCollection = {
            type: "FeatureCollection",
            features: Array.isArray(selection)
              ? selection.map((f) => f.feature)
              : USelection.getSelectedFeatures({
                  ...data,
                  hydraulicModel,
                  selection,
                }).map((f) => f.feature),
          };
          extent = getExtent(selectedFeatures);
        }

        extent.ifJust((extent) => {
          map?.map.fitBounds(extent as LngLatBoundsLike, {
            padding: map?.map.getCanvas().getBoundingClientRect().width / 10,
            animate: false,
            // Avoid extreme zooms when we're locating a point.
            // Otherwise, zoom to the thing.
            maxZoom: maxZoom ?? (isBBoxEmpty(extent) ? 18 : Infinity),
          });
        });
      },
      [map, isStateRefactorOn],
    ),
  );
}
