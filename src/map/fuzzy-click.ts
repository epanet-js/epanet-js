import type { MapboxGeoJSONFeature, Map as MapboxMap } from "mapbox-gl";
import { Feature } from "geojson";
import { clickableLayers } from "./layers/layer";

export type MouseOrTouchEvent = mapboxgl.MapMouseEvent | mapboxgl.MapTouchEvent;

type QueryOptions = Parameters<MapboxMap["queryRenderedFeatures"]>[1];
const queryOptions: Parameters<MapboxMap["queryRenderedFeatures"]>[1] = {
  layers: clickableLayers,
};

type Point = { x: number; y: number };
type Box = [[number, number], [number, number]];
export type QueryProvider = {
  queryRenderedFeatures: (
    pointOrBox: Point | Box,
    options: QueryOptions,
  ) => MapboxGeoJSONFeature[];
};

export const getClickedFeature = (
  map: QueryProvider,
  point: { x: number; y: number },
): RawId | null => {
  let features = map.queryRenderedFeatures(point, queryOptions);
  if (!features.length) {
    features = map.queryRenderedFeatures(createBox(point), queryOptions);
  }
  const feature = chooseFeature(features);
  if (!feature) return null;

  return feature.id as RawId;
};

const chooseFeature = (features: MapboxGeoJSONFeature[]): Feature | null => {
  if (!features.length) return null;
  const visibleFeatures = features.filter((f) => !f.state || !f.state.hidden);

  const point = visibleFeatures.find((f) => f.geometry.type === "Point");
  if (point) return point;

  return visibleFeatures[0];
};

const createBox = (point: Point): Box => {
  const ry = 10;
  const rx = ry;
  return [
    [point.x - rx, point.y - ry],
    [point.x + rx, point.y + ry],
  ];
};
