import { newFeatureId } from "src/lib/id";
import {
  IFeature,
  IWrappedFeature,
  LineString,
  Point,
  Position,
} from "src/types";
import { JsonValue } from "type-fest";

type StrictProperties = { [name: string]: JsonValue } | null;
type PointFeature = IFeature<Point, StrictProperties>;
type LineStringFeature = IFeature<LineString, StrictProperties>;

export type Junction = IWrappedFeature<PointFeature>;
export type Pipe = IWrappedFeature<LineStringFeature>;

export type NodeAsset = Junction;

export const createJunction = (
  position: Position,
  id = newFeatureId(),
): Junction => {
  return {
    id,
    feature: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Point",
        coordinates: position,
      },
    },
    folderId: null,
    at: "any",
  };
};

export const createPipe = (coordinates: Position[]): Pipe => {
  return {
    id: newFeatureId(),
    feature: {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates: coordinates,
      },
    },
    folderId: null,
    at: "any",
  };
};
