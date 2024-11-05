import { isSamePosition } from "src/lib/geometry";
import { newFeatureId } from "src/lib/id";
import replaceCoordinates from "src/lib/replace_coordinates";
import {
  FeatureMap,
  IFeature,
  IWrappedFeature,
  LineString,
  Point,
  Position,
} from "src/types";
import { JsonValue } from "type-fest";
import cloneDeep from "lodash/cloneDeep";

type LinkConnections = [start: string, end: string];

type StrictProperties = { [name: string]: JsonValue };
type NodeFeature = IFeature<Point, StrictProperties>;
type LinkFeature = IFeature<
  LineString,
  StrictProperties & { connections: LinkConnections }
>;

export type Junction = IWrappedFeature<NodeFeature>;
export type Pipe = IWrappedFeature<LinkFeature>;

export type NodeAsset = Junction;
export type LinkAsset = Pipe;
export type AssetId = StringId;
export type Asset = NodeAsset | LinkAsset;
export type AssetsMap = FeatureMap;

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

export const createPipe = (
  coordinates: Position[] = [],
  id = newFeatureId(),
): Pipe => {
  const nullConnections = ["", ""] as LinkConnections;

  return {
    id,
    feature: {
      type: "Feature",
      properties: {
        connections: nullConnections,
      },
      geometry: {
        type: "LineString",
        coordinates: coordinates,
      },
    },
    folderId: null,
    at: "any",
  };
};

export const extendLink = (link: LinkAsset, position: Position): LinkAsset => {
  const feature = link.feature;
  const coordinates = feature.geometry.coordinates.slice(0, -1);

  return {
    ...link,
    feature: replaceCoordinates(
      feature,
      coordinates.concat([position]),
    ) as LinkFeature,
  };
};

export const addVertexToLink = (
  link: LinkAsset,
  position: Position,
): LinkAsset => {
  const feature = link.feature;
  const coordinates = feature.geometry.coordinates;

  return {
    ...link,
    feature: replaceCoordinates(
      feature,
      coordinates.concat([position]),
    ) as LinkFeature,
  };
};

export const isLinkStart = (link: LinkAsset, position: Position) => {
  const coordinates = getLinkCoordinates(link);
  return isSamePosition(coordinates[0], position) && coordinates.length == 2;
};

export const isLink = (candidate: Asset) => {
  return candidate.feature.geometry.type === "LineString";
};

export const attachConnections = (
  link: LinkAsset,
  startNodeId: string,
  endNodeId: string,
) => {
  const newLink = cloneDeep(link);
  newLink.feature.properties.connections = [startNodeId, endNodeId];
  return newLink;
};

export const getLinkCoordinates = (link: LinkAsset): Position[] => {
  const { feature } = link;
  if (!feature || !feature.geometry || feature.geometry.type !== "LineString") {
    throw new Error("Feature is not a valid link");
  }

  return feature.geometry.coordinates;
};

export const getAssetConnections = (asset: Asset): LinkConnections | null => {
  if (!isLink(asset)) return null;

  return (asset as LinkAsset).feature.properties.connections;
};

export const getNodeCoordinates = (node: NodeAsset): Position => {
  const { feature } = node;
  if (!feature || !feature.geometry || feature.geometry.type !== "Point") {
    throw new Error("Feature is not a valid point");
  }

  return feature.geometry.coordinates;
};

export const updateNodeCoordinates = (
  node: NodeAsset,
  newCoordinates: Position,
): NodeAsset => {
  return {
    ...node,
    feature: {
      ...node.feature,
      geometry: {
        type: "Point",
        coordinates: newCoordinates,
      },
    },
  };
};

export const updateLinkCoordinates = (
  link: LinkAsset,
  newCoordinates: Position[],
): LinkAsset => {
  return {
    ...link,
    feature: {
      ...link.feature,
      geometry: {
        type: "LineString",
        coordinates: newCoordinates,
      },
    },
  };
};

export const updateMatchingEndpoints = (
  link: LinkAsset,
  matchingCoordinates: Position,
  newCoordinates: Position,
) => {
  const linkCoordinates = getLinkCoordinates(link);

  const newLinkCoordinates = [...linkCoordinates];
  if (isSamePosition(matchingCoordinates, linkCoordinates[0])) {
    newLinkCoordinates[0] = newCoordinates;
  }
  if (isSamePosition(matchingCoordinates, linkCoordinates.at(-1) as Position)) {
    newLinkCoordinates[newLinkCoordinates.length - 1] = newCoordinates;
  }
  return updateLinkCoordinates(link, newLinkCoordinates);
};
