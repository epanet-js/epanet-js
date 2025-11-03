import type {
  IWrappedFeature,
  Polygon,
  LineString,
  FeatureMap,
  FolderMap,
} from "src/types";
import type { Map as MapboxMap } from "mapbox-gl";
import { bufferPoint } from "src/lib/geometry";
import { decodeId } from "src/lib/id";
import sortBy from "lodash/sortBy";
import { isFeatureLocked } from "./folder";
import { getMapCoord } from "src/map/map-event";
import { MapEngine } from "src/map";
import { DECK_SYNTHETIC_ID } from "src/lib/constants";
import { clickableLayers } from "src/map/layers/layer";

type MouseOrTouchEvent = mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent;

export function wrappedFeaturesFromMapFeatures(
  clickedFeatures: mapboxgl.MapboxGeoJSONFeature[],
  featureMapDeprecated: FeatureMap,
) {
  const set = new Set<IWrappedFeature>();
  const ids: { id: Id; wrappedFeature: IWrappedFeature }[] = [];
  for (const feature of clickedFeatures) {
    const f = featureMapDeprecated.get(feature.id as RawId);
    if (f) {
      set.add(f);
      ids.push({ id: decodeId(feature.id as RawId), wrappedFeature: f });
    }
  }
  return {
    ids,
    features: sortBy(Array.from(set), "at"),
  };
}

export function newLineStringFromClickEvent(e: MouseOrTouchEvent): LineString {
  const pos = getMapCoord(e);
  return {
    type: "LineString",
    coordinates: [pos, pos],
  };
}

/**
 * Create a new, zero-area polygon from a position.
 */
export function newPolygonFromClickEvent(e: MouseOrTouchEvent): Polygon {
  const pos = getMapCoord(e);
  return {
    type: "Polygon",
    coordinates: [[pos, pos, pos]],
  };
}

const QRF_OPTIONS: Parameters<MapboxMap["queryRenderedFeatures"]>[1] = {
  layers: clickableLayers,
};

/**
 * Select the feature under the cursor, or if there
 * is none, a feature within a fuzzy range of that cursor.
 */
export type ClickedFeature = {
  wrappedFeature: IWrappedFeature;
  decodedId: Id;
  id: RawId;
};
export function fuzzyClick(
  e: MouseOrTouchEvent,
  {
    featureMapDeprecated,
    folderMap,
    pmap,
  }: {
    featureMapDeprecated: FeatureMap;
    folderMap: FolderMap;
    pmap: MapEngine;
  },
): ClickedFeature | null {
  const map = e.target;

  const ids: RawId[] = [];

  const pickInfo = pmap.overlay.pickObject({
    ...e.point,
    layerIds: [DECK_SYNTHETIC_ID],
  });

  if (pickInfo) {
    ids.push(pickInfo.object.id as RawId);
  } else {
    const multiPickInfo = pmap.overlay.pickMultipleObjects({
      ...e.point,
      radius: 10,
      layerIds: [DECK_SYNTHETIC_ID],
    });

    if (multiPickInfo) {
      for (const info of multiPickInfo) {
        ids.push(info.object.id as RawId);
      }
    }
  }

  let mapFeatures = map.queryRenderedFeatures(e.point, QRF_OPTIONS);
  if (!mapFeatures.length) {
    mapFeatures = map.queryRenderedFeatures(bufferPoint(e.point), QRF_OPTIONS);
  }

  for (const feature of mapFeatures) {
    ids.push(feature.id as RawId);
  }

  const results: Array<{
    wrappedFeature: IWrappedFeature;
    decodedId: Id;
    id: RawId;
  }> = [];

  for (const id of ids) {
    const decodedId = decodeId(id);
    const wrappedFeature = featureMapDeprecated.get(decodedId.featureId);
    if (wrappedFeature && !isFeatureLocked(wrappedFeature, folderMap)) {
      results.push({ wrappedFeature, decodedId, id });
    }
  }

  results.sort((a, b) => {
    return a.wrappedFeature.at > b.wrappedFeature.at ? -1 : 1;
  });

  return results[0] || null;
}
