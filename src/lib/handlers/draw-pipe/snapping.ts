import { MapMouseEvent, MapTouchEvent, PointLike } from "mapbox-gl";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import PMap from "src/lib/pmap";
import { Position } from "src/types";
import { FEATURES_POINT_LAYER_NAME } from "../../load_and_augment_style";
import { decodeId } from "src/lib/id";
import { AssetsMap, NodeAsset } from "src/hydraulics/assets";

export const useSnapping = (pmap: PMap, idMap: IDMap, assetsMap: AssetsMap) => {
  const getNeighborPoint = (point: mapboxgl.Point): string | null => {
    const { x, y } = point;
    const distance = 12;

    const searchBox = [
      [x - distance, y - distance] as PointLike,
      [x + distance, y + distance] as PointLike,
    ] as [PointLike, PointLike];

    const pointFeatures = pmap.map.queryRenderedFeatures(searchBox, {
      layers: [FEATURES_POINT_LAYER_NAME],
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
    const featureId = getNeighborPoint(e.point);
    if (!featureId) return null;

    const wrappedFeature = assetsMap.get(featureId);
    if (!wrappedFeature) return null;

    const geometry = wrappedFeature.feature.geometry;
    if (!geometry || geometry.type !== "Point") return null;

    return wrappedFeature as NodeAsset;
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
