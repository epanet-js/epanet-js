import { MapContext } from "src/map";
import { useAtomCallback } from "jotai/utils";
import { getExtent, isBBoxEmpty } from "src/lib/geometry";
import { LngLatBoundsLike } from "mapbox-gl";
import { Maybe } from "purify-ts/Maybe";
import { useCallback, useContext } from "react";
import { USelection } from "src/selection";
import { dataAtom, Sel } from "src/state/jotai";
import { BBox, FeatureCollection, IWrappedFeature } from "src/types";

export function useZoomTo() {
  const map = useContext(MapContext);

  return useAtomCallback(
    useCallback(
      (
        get,
        _set,
        selection: Sel | IWrappedFeature[] | Maybe<BBox>,
        maxZoom?: number,
      ) => {
        const data = get(dataAtom);
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
      [map],
    ),
  );
}
