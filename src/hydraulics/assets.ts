import { isSamePosition } from "src/lib/geometry";
import { newFeatureId } from "src/lib/id";
import replaceCoordinates from "src/lib/replace_coordinates";
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
export type LinkAsset = Pipe;

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

export const extendLink = (link: LinkAsset, position: Position) => {
  const feature = link.feature;
  const coordinates = feature.geometry.coordinates.slice(0, -1);

  return {
    ...link,
    feature: replaceCoordinates(feature, coordinates.concat([position])),
  };
};

export const addVertexToLink = (link: LinkAsset, position: Position) => {
  const feature = link.feature;
  const coordinates = feature.geometry.coordinates;

  return {
    ...link,
    feature: replaceCoordinates(feature, coordinates.concat([position])),
  };
};

export const isLinkStart = (link: LinkAsset, position: Position) => {
  const coordinates = getLinkCoordinates(link);
  return isSamePosition(coordinates[0], position) && coordinates.length == 2;
};

export const getLinkCoordinates = (link: LinkAsset): Position[] => {
  const { feature } = link;
  if (!feature || !feature.geometry || feature.geometry.type !== "LineString") {
    throw new Error("Feature is not a valid point");
  }

  return feature.geometry.coordinates;
};

export const getNodeCoordinates = (node: NodeAsset): Position => {
  const { feature } = node;
  if (!feature || !feature.geometry || feature.geometry.type !== "Point") {
    throw new Error("Feature is not a valid point");
  }

  return feature.geometry.coordinates;
};
