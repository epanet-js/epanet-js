import { MapContext } from "src/map";
import { useAtomCallback } from "jotai/utils";
import { extendExtent, getExtent, isBBoxEmpty } from "@epanet-js/geometry";
import { LngLatBoundsLike } from "mapbox-gl";
import { Just, Maybe, Nothing } from "purify-ts/Maybe";
import { useCallback, useContext } from "react";
import { USelection } from "src/selection";
import type { Sel } from "src/selection";
import { stagingModelDerivedAtom } from "src/state/derived-branch-state";
import { BBox, Feature, IWrappedFeature } from "src/types";
import type { HydraulicModel } from "src/hydraulic-model";

const assetsExtent = (
  selection: Sel,
  hydraulicModel: HydraulicModel,
): Maybe<BBox> => {
  const features: Feature[] = [];
  for (const id of USelection.getAssetIds(selection)) {
    const asset = hydraulicModel.assets.get(id);
    if (asset) features.push(asset.feature);
  }
  return getExtent({ type: "FeatureCollection", features });
};

const customerPointsExtent = (
  selection: Sel,
  hydraulicModel: HydraulicModel,
): Maybe<BBox> => {
  const ids = USelection.getCustomerPointIds(selection);
  if (ids.length === 0) return Nothing;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const id of ids) {
    const cp = hydraulicModel.customerPoints.get(id);
    if (!cp) continue;
    const [x, y] = cp.coordinates;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  if (!Number.isFinite(minX)) return Nothing;
  return Just([minX, minY, maxX, maxY]);
};

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
        const hydraulicModel = get(stagingModelDerivedAtom);
        let extent: Maybe<BBox>;
        if (Maybe.isMaybe(selection)) {
          extent = selection;
        } else if (Array.isArray(selection)) {
          extent = getExtent({
            type: "FeatureCollection",
            features: selection.map((f) => f.feature),
          });
        } else {
          extent = extendExtent(
            assetsExtent(selection, hydraulicModel),
            customerPointsExtent(selection, hydraulicModel),
          );
        }

        extent.ifJust((extent) => {
          map?.map.fitBounds(extent as LngLatBoundsLike, {
            padding: map?.map.getCanvas().getBoundingClientRect().width / 10,
            animate: false,
            maxZoom: maxZoom ?? (isBBoxEmpty(extent) ? 18 : Infinity),
          });
        });
      },
      [map],
    ),
  );
}
