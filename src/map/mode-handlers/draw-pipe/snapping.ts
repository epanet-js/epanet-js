import { MapMouseEvent, MapTouchEvent, PointLike } from "mapbox-gl";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import type { MapEngine } from "src/map/map-engine";
import { Position } from "src/types";
import { FEATURES_POINT_LAYER_NAME } from "src/lib/load_and_augment_style";
import { decodeId } from "src/lib/id";
import { AssetsMap, getNode } from "src/hydraulics/assets-map";
import { NodeAsset } from "src/hydraulics/asset-types";
import { isFeatureOn } from "src/infra/feature-flags";

export const useSnapping = (
  map: MapEngine,
  idMap: IDMap,
  assetsMap: AssetsMap,
) => {
  const getNeighborPoint = (point: mapboxgl.Point): string | null => {
    const { x, y } = point;
    const distance = 12;

    const searchBox = [
      [x - distance, y - distance] as PointLike,
      [x + distance, y + distance] as PointLike,
    ] as [PointLike, PointLike];

    const pointFeatures = map.map.queryRenderedFeatures(searchBox, {
      layers: isFeatureOn("FLAG_RESERVOIR")
        ? [FEATURES_POINT_LAYER_NAME, "reservoirs-layer"]
        : [FEATURES_POINT_LAYER_NAME],
    });
    if (!pointFeatures.length) return null;

    const id = pointFeatures[0].id;
    const decodedId = decodeId(id as RawId);
    const uuid = UIDMap.getUUID(idMap, decodedId.featureId);

    return uuid;
  };

  const getSnappingNode = (
    e: MapMouseEvent | MapTouchEvent,
  ): NodeAsset | null => {
    const assetId = getNeighborPoint(e.point);
    if (!assetId) return null;

    return getNode(assetsMap, assetId);
  };

  const getSnappingCoordinates = (
    e: MapMouseEvent | MapTouchEvent,
  ): Position | null => {
    const featureId = getNeighborPoint(e.point);
    if (!featureId) return null;

    const wrappedFeature = assetsMap.get(featureId);
    if (!wrappedFeature) return null;

    const { feature } = wrappedFeature;
    if (!feature.geometry || feature.geometry.type !== "Point") return null;

    return feature.geometry.coordinates;
  };

  return {
    getSnappingNode,
    getSnappingCoordinates,
  };
};
