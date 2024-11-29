import { MapMouseEvent, MapTouchEvent } from "mapbox-gl";
import { IDMap, UIDMap } from "src/lib/id_mapper";
import type { MapEngine } from "../../map-engine";
import { Position } from "src/types";
import { decodeId } from "src/lib/id";
import { AssetsMap, getNode } from "src/hydraulic-model";
import { NodeAsset } from "src/hydraulic-model";
import { searchNearbyRenderedFeatures } from "src/map/search";

export const useSnapping = (
  map: MapEngine,
  idMap: IDMap,
  assetsMap: AssetsMap,
) => {
  const getNeighborPoint = (point: mapboxgl.Point): string | null => {
    const pointFeatures = searchNearbyRenderedFeatures(map, {
      point,
      layers: [
        "junctions",
        "imported-junctions",
        "reservoirs",
        "imported-reservoirs",
      ],
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
