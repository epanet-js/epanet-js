import { IDMap } from "src/lib/id-mapper";
import { Feature } from "src/types";
import { Asset, NodeAsset, LinkAsset } from "src/hydraulic-model/asset-types";
import { AssetsMap } from "src/hydraulic-model";
import {
  EphemeralEditingState,
  EphemeralConnectCustomerPoints,
} from "src/state/jotai";
import { EphemeralMoveAssets } from "../mode-handlers/none/move-state";
import { EphemeralDrawNode } from "../mode-handlers/draw-node/ephemeral-draw-node-state";
import { EphemeralDrawLinkDeprecated } from "../mode-handlers/draw-link";
import { EphemeralDrawLink } from "../mode-handlers/draw-link/ephemeral-link-state";

export const buildEphemeralStateSource = (
  ephemeralState: EphemeralEditingState,
  _idMap: IDMap,
  assets: AssetsMap,
): Feature[] => {
  if (ephemeralState.type == "drawLinkDeprecated") {
    return buildDrawLinkSourceDataDeprecated(ephemeralState);
  }

  if (ephemeralState.type == "drawLink") {
    return buildDrawLinkSourceData(ephemeralState);
  }

  if (ephemeralState.type === "drawNode") {
    return buildDrawNodeSourceData(ephemeralState, assets);
  }

  if (ephemeralState.type === "moveAssets") {
    return buildMoveAssetsSourceData(ephemeralState);
  }

  if (ephemeralState.type === "connectCustomerPoints") {
    return buildConnectCustomerPointsSourceData(ephemeralState, assets);
  }

  return [];
};

const buildMoveAssetsSourceData = (ephemeralState: EphemeralMoveAssets) => {
  const features: Feature[] = [];

  const iconProps = (asset: Asset) => {
    if (asset.isLink || asset.type === "junction") return {};

    return { icon: `${asset.type}-highlight` };
  };

  for (const asset of ephemeralState.targetAssets) {
    features.push({
      ...asset.feature,
      properties: {
        ...iconProps(asset),
      } as any,
    });
  }

  return features;
};

const buildDrawLinkSourceData = (
  ephemeralState: EphemeralDrawLink,
): Feature[] => {
  const features: Feature[] = [];

  const iconProps = (type: Asset["type"]) => {
    if (type === "junction") return {};

    return { icon: `${type}-highlight` };
  };

  if (ephemeralState.snappingCandidate) {
    const candidate = ephemeralState.snappingCandidate;
    features.push({
      type: "Feature",
      id: `snapping-${candidate.type}`,
      properties: {
        halo: true,
        ...iconProps(candidate.type),
      } as any,
      geometry: {
        type: "Point",
        coordinates: candidate.position,
      },
    });
  }

  if (ephemeralState.startNode) {
    const startNode = ephemeralState.startNode;
    features.push({
      type: "Feature",
      id: startNode.id,
      properties: {
        ...iconProps(startNode.type),
      } as any,
      geometry: {
        type: "Point",
        coordinates: startNode.coordinates,
      },
    });
  }

  const linkCoordinates = ephemeralState.link.coordinates;
  features.push({
    type: "Feature",
    id: "draw-link-line",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: linkCoordinates,
    },
  });

  return features;
};

const buildDrawLinkSourceDataDeprecated = (
  ephemeralState: EphemeralDrawLinkDeprecated,
): Feature[] => {
  const features: Feature[] = [];

  const iconProps = (node: NodeAsset) => {
    if (node.type === "junction") return {};

    return { icon: `${node.type}-highlight` };
  };

  if (ephemeralState.snappingCandidate) {
    const candidate = ephemeralState.snappingCandidate;
    features.push({
      type: "Feature",
      id: `snapping-${candidate.id}`,
      properties: {
        halo: true,
        ...iconProps(candidate),
      } as any,
      geometry: {
        type: "Point",
        coordinates: candidate.coordinates,
      },
    });
  }

  if (ephemeralState.startNode) {
    const startNode = ephemeralState.startNode;
    features.push({
      type: "Feature",
      id: startNode.id,
      properties: {
        ...iconProps(startNode),
      } as any,
      geometry: {
        type: "Point",
        coordinates: startNode.coordinates,
      },
    });
  }

  const linkCoordinates = ephemeralState.link.coordinates;
  features.push({
    type: "Feature",
    id: "draw-link-line",
    properties: {},
    geometry: {
      type: "LineString",
      coordinates: linkCoordinates,
    },
  });

  return features;
};

const buildConnectCustomerPointsSourceData = (
  ephemeralState: EphemeralConnectCustomerPoints,
  assets: AssetsMap,
): Feature[] => {
  const features: Feature[] = [];

  if (ephemeralState.targetPipeId) {
    const pipe = assets.get(ephemeralState.targetPipeId) as LinkAsset;
    if (pipe && pipe.isLink) {
      features.push({
        type: "Feature",
        id: `pipe-highlight-${ephemeralState.targetPipeId}`,
        properties: {
          pipeHighlight: true,
        },
        geometry: {
          type: "LineString",
          coordinates: pipe.coordinates,
        },
      });
    }
  }

  return features;
};

const buildDrawNodeSourceData = (
  ephemeralState: EphemeralDrawNode,
  assets: AssetsMap,
): Feature[] => {
  const features: Feature[] = [];
  if (!ephemeralState.pipeSnappingPosition) return [];

  if (ephemeralState.pipeSnappingPosition && ephemeralState.pipeId) {
    const pipe = assets.get(ephemeralState.pipeId) as LinkAsset;
    if (pipe && pipe.isLink) {
      features.push({
        type: "Feature",
        id: `pipe-highlight-${ephemeralState.pipeId}`,
        properties: {
          pipeHighlight: true,
        },
        geometry: {
          type: "LineString",
          coordinates: pipe.coordinates,
        },
      });
    }

    const properties: any = { halo: true };
    if (ephemeralState.nodeType !== "junction") {
      properties.icon = `${ephemeralState.nodeType}-highlight`;
    }

    features.push({
      type: "Feature",
      id: "pipe-snap-point",
      properties,
      geometry: {
        type: "Point",
        coordinates: ephemeralState.pipeSnappingPosition,
      },
    });
  }

  return features;
};
