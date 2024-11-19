import { isSamePosition } from "src/lib/geometry";
import { newFeatureId } from "src/lib/id";
import {
  IFeature,
  IWrappedFeature,
  LineString,
  Point,
  Position,
} from "src/types";
import cloneDeep from "lodash/cloneDeep";

type LinkConnections = [start: string, end: string];

type VisibilityProps = { visibility?: boolean };

type JunctionAttributes = {
  elevation: number;
};

export type PipeAttributes = {
  length: number;
};

type NodeFeature<T> = IFeature<Point, VisibilityProps & T>;
type LinkFeature<T> = IFeature<
  LineString,
  VisibilityProps & { connections: LinkConnections } & T
>;

export type Junction = IWrappedFeature<NodeFeature<JunctionAttributes>>;
export type Pipe = IWrappedFeature<LinkFeature<PipeAttributes>>;

export type NodeAsset = Junction;
export type LinkAsset = Pipe;
export type AssetId = StringId;
export type Asset = NodeAsset | LinkAsset;

export class AssetsMap extends Map<AssetId, Asset> {}

export const filterAssets = (
  assets: AssetsMap,
  assetIds: Set<AssetId> | AssetId[],
): AssetsMap => {
  const resultAssets = new AssetsMap();
  for (const assetId of assetIds) {
    const asset = assets.get(assetId);
    if (!asset) continue;

    resultAssets.set(asset.id, asset);
  }
  return resultAssets;
};

export const createJunction = ({
  coordinates,
  id = newFeatureId(),
  elevation = 0,
}: {
  coordinates: Position;
  id?: AssetId;
  elevation?: number;
}): Junction => {
  return {
    id,
    feature: {
      type: "Feature",
      properties: {
        elevation,
      },
      geometry: {
        type: "Point",
        coordinates,
      },
    },
    folderId: null,
    at: "any",
  };
};

export const createPipe = ({
  coordinates,
  id = newFeatureId(),
}: {
  coordinates: Position[];
  id?: AssetId;
  length?: number;
}): Pipe => {
  const nullConnections = ["", ""] as LinkConnections;
  const nullLength = 0;
  return {
    id,
    feature: {
      type: "Feature",
      properties: {
        length: length || nullLength,
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

  return updateLinkCoordinates(link, coordinates.concat([position]));
};

export const addVertexToLink = (
  link: LinkAsset,
  position: Position,
): LinkAsset => {
  const feature = link.feature;
  const coordinates = feature.geometry.coordinates;

  return updateLinkCoordinates(link, coordinates.concat([position]));
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

export const getNodeElevation = (node: NodeAsset) => {
  return node.feature.properties.elevation;
};

export const assignElevation = (node: NodeAsset, elevation: number) => {
  return assignProperties(node, { elevation }) as NodeAsset;
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

export const getLinkConnections = (link: LinkAsset): LinkConnections => {
  return link.feature.properties.connections;
};

const assignProperties = (
  asset: Asset,
  newProperties: Partial<JunctionAttributes>,
) => {
  return {
    ...asset,
    feature: {
      ...asset.feature,
      properties: {
        ...asset.feature.properties,
        ...newProperties,
      },
    },
  };
};
