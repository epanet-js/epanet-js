import { Asset, AssetsMap } from "src/hydraulic-model";
import { e6position, precisionForZoom } from "src/lib/geometry";
import { decodeId } from "src/lib/id";
import { QueryProvider, getClickedFeature } from "src/map/fuzzy-click";
import { useFeatureFlag } from "src/hooks/use-feature-flags";
import { MapEngine } from "../map-engine";

// LEGACY: remove once FLAG_DRAWING_PRECISION is permanently on.
export function getMapCoord(
  e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
) {
  return e6position(e.lngLat.toArray(), 7) as Pos2;
}

export function getMapCoordWithPrecision(
  e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
) {
  return e6position(
    e.lngLat.toArray(),
    precisionForZoom(e.target.getZoom()),
  ) as Pos2;
}

export const useGetMapCoord = () => {
  const withPrecision = useFeatureFlag("FLAG_DRAWING_PRECISION");
  return withPrecision ? getMapCoordWithPrecision : getMapCoord;
};

export const useClickedAsset = (map: MapEngine, assets: AssetsMap) => {
  const getClickedAsset = (
    e: mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent,
  ): Asset | null => {
    const rawId = getClickedFeature(map as QueryProvider, e.point);
    if (rawId === null) return null;

    const decodedId = decodeId(rawId);
    const assetId = decodedId.featureId;

    const asset = assets.get(assetId);
    if (!asset) return null;

    return asset;
  };

  return { getClickedAsset };
};
