import { MapMouseEvent, MapTouchEvent } from "mapbox-gl";
import type { MapEngine } from "../../map-engine";
import { Position } from "src/types";
import { decodeId } from "src/lib/id";
import { AssetsMap, getNode } from "src/hydraulic-model";
import { NodeAsset } from "src/hydraulic-model";
import { searchNearbyRenderedFeatures } from "src/map/search";

export const useSnapping = (map: MapEngine, assetsMap: AssetsMap) => {
  const getNeighborPoint = (point: mapboxgl.Point): number | null => {
    const pointFeatures = searchNearbyRenderedFeatures(map, {
      point,
      layers: [
        "delta-features-junctions",
        "main-features-junctions",
        "delta-features-junction-results",
        "main-features-junction-results",
        "icons-tanks",
        "icons-reservoirs",
      ],
    });
    if (!pointFeatures.length) return null;

    const id = pointFeatures[0].id;
    const decodedId = decodeId(id as RawId);

    return decodedId.featureId;
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
