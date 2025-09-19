import { Asset, AssetsMap } from "src/hydraulic-model";
import { e6position } from "src/lib/geometry";
import { decodeId } from "src/lib/id";
import { QueryProvider, getClickedFeature } from "src/map/fuzzy-click";
import { MapEngine } from "../map-engine";
import { IDMap, UIDMap } from "src/lib/id-mapper";

export function getMapCoord(
  e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
) {
  return e6position(e.lngLat.toArray(), 7) as Pos2;
}

export const useClickedAsset = (
  map: MapEngine,
  idMap: IDMap,
  assets: AssetsMap,
) => {
  const getClickedAsset = (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ): Asset | null => {
    const rawId = getClickedFeature(map as QueryProvider, e.point);
    if (rawId === null) return null;

    const decodedId = decodeId(rawId);
    const uuid = UIDMap.getUUID(idMap, decodedId.featureId);

    const asset = assets.get(uuid);
    if (!asset) return null;

    return asset;
  };

  return { getClickedAsset };
};
