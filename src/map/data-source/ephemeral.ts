import { Feature, Position } from "src/types";
import { Asset, NodeAsset, LinkAsset } from "src/hydraulic-model/asset-types";
import { AssetsMap } from "src/hydraulic-model";
import {
  DraftPath,
  EphemeralEditingState,
  EphemeralConnectCustomerPoints,
  EphemeralProfileView,
} from "src/state/drawing";
import { Mode } from "src/state/mode";
import { EphemeralMoveAssets } from "../mode-handlers/none/move-state";
import { EphemeralDrawNode } from "../mode-handlers/draw-node/ephemeral-draw-node-state";
import { EphemeralDrawLink } from "../mode-handlers/draw-link/ephemeral-link-state";
import { EphemeralEditingStateAreaSelection } from "../mode-handlers/area-selection/ephemeral-area-selection-state";
import { polygonCoordinatesFromPositions } from "src/lib/geometry";

export const buildEphemeralStateSource = (
  ephemeralState: EphemeralEditingState,
  assets: AssetsMap,
): Feature[] => {
  const draftPathFeatures =
    "path" in ephemeralState && ephemeralState.path
      ? buildDraftPathFeatures(ephemeralState.path, assets)
      : [];

  if (ephemeralState.type == "drawLink") {
    return [
      ...draftPathFeatures,
      ...buildDrawLinkSourceData(ephemeralState, assets),
    ];
  }

  if (ephemeralState.type === "drawNode") {
    return [
      ...draftPathFeatures,
      ...buildDrawNodeSourceData(ephemeralState, assets),
    ];
  }

  if (ephemeralState.type === "moveAssets") {
    return [
      ...draftPathFeatures,
      ...buildMoveAssetsSourceData(ephemeralState, assets),
    ];
  }

  if (ephemeralState.type === "connectCustomerPoints") {
    return [
      ...draftPathFeatures,
      ...buildConnectCustomerPointsSourceData(ephemeralState, assets),
    ];
  }

  if (ephemeralState.type === "moveCustomerPoint") {
    return draftPathFeatures;
  }

  if (ephemeralState.type === "areaSelect") {
    return [
      ...draftPathFeatures,
      ...buildAreaSelectionSourceData(ephemeralState),
    ];
  }

  if (ephemeralState.type === "profileView") {
    return [
      ...draftPathFeatures,
      ...buildProfileViewSourceData(ephemeralState, assets),
    ];
  }

  return draftPathFeatures;
};

const buildDraftPathFeatures = (
  path: DraftPath,
  assets: AssetsMap,
): Feature[] => {
  const features: Feature[] = [];

  for (const nodeId of path.nodeIds) {
    const asset = assets.get(nodeId);
    if (!asset || asset.isLink) continue;
    const node = asset as NodeAsset;
    const properties: any = { draftPath: true };
    if (node.type === "tank" || node.type === "reservoir") {
      properties.icon = `${node.type}-highlighted`;
      properties.type = node.type;
    }
    features.push({
      type: "Feature",
      id: `draft-path-node-${nodeId}`,
      properties,
      geometry: {
        type: "Point",
        coordinates: node.coordinates,
      },
    });
  }

  for (const linkId of path.linkIds) {
    const asset = assets.get(linkId);
    if (!asset || !asset.isLink) continue;
    const link = asset as LinkAsset;
    features.push({
      type: "Feature",
      id: `draft-path-link-${linkId}`,
      properties: { draftPath: true },
      geometry: {
        type: "LineString",
        coordinates: link.coordinates,
      },
    });
  }

  return features;
};

const assetIconProps = (asset: Asset) => {
  if (asset.isLink || asset.type === "junction") return {};
  return { icon: `${asset.type}-highlight` };
};

const buildProfileViewSourceData = (
  state: EphemeralProfileView,
  assets: AssetsMap,
): Feature[] => {
  const features: Feature[] = [];
  const ids = new Set<number>();
  if (state.hoveredNodeId !== undefined) ids.add(state.hoveredNodeId);
  if (state.startNodeId !== undefined && !state.path) {
    ids.add(state.startNodeId);
  }

  for (const id of ids) {
    const asset = assets.get(id);
    if (!asset || asset.isLink) continue;
    features.push({
      ...asset.feature,
      properties: {
        ...asset.feature.properties,
        ...assetIconProps(asset),
      },
    } as Feature);
  }
  return features;
};

const buildMoveAssetsSourceData = (
  ephemeralState: EphemeralMoveAssets,
  assets: AssetsMap,
) => {
  const features: Feature[] = [];

  for (const asset of ephemeralState.targetAssets) {
    features.push({
      ...asset.feature,
      properties: {
        draft: true,
        ...assetIconProps(asset),
      } as any,
    });
  }

  if (ephemeralState.pipeSnappingPosition && ephemeralState.pipeId) {
    const pipe = assets.get(Number(ephemeralState.pipeId)) as LinkAsset;
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

    features.push({
      type: "Feature",
      id: "pipe-snap-point",
      properties: {
        halo: true,
      },
      geometry: {
        type: "Point",
        coordinates: ephemeralState.pipeSnappingPosition,
      },
    });
  }

  if (ephemeralState.nodeSnappingId) {
    const node = assets.get(Number(ephemeralState.nodeSnappingId)) as NodeAsset;
    if (node && !node.isLink) {
      const properties: any = { halo: true };
      if (node.type !== "junction") {
        properties.icon = `${node.type}-highlight`;
      }

      features.push({
        type: "Feature",
        id: `node-snapping-${ephemeralState.nodeSnappingId}`,
        properties,
        geometry: {
          type: "Point",
          coordinates: node.coordinates,
        },
      });
    }
  }

  return features;
};

const buildDrawLinkSourceData = (
  ephemeralState: EphemeralDrawLink,
  assets: AssetsMap,
): Feature[] => {
  const features: Feature[] = [];

  const iconProps = (type: Asset["type"]) => {
    if (type === "junction" || type === "pipe") return {};

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
        coordinates: candidate.coordinates,
      },
    });

    if (candidate.type === "pipe") {
      const pipe = assets.get(candidate.id) as LinkAsset;
      if (pipe && pipe.isLink) {
        features.push({
          type: "Feature",
          id: `pipe-highlight-${candidate.id}`,
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

  if (ephemeralState.draftJunction) {
    features.push({
      type: "Feature",
      id: "draft-junction-hint",
      properties: {} as any,
      geometry: {
        type: "Point",
        coordinates: ephemeralState.draftJunction.coordinates,
      },
    });
  }

  if (ephemeralState.sourceLink) {
    features.push({
      type: "Feature",
      id: "shadow-line",
      properties: {
        shadowLine: true,
      },
      geometry: {
        type: "LineString",
        coordinates: ephemeralState.sourceLink.coordinates,
      },
    });
  }

  if (ephemeralState.link) {
    const linkCoordinates = ephemeralState.link.coordinates;
    features.push({
      type: "Feature",
      id: "draw-link-line",
      properties: {
        draft: true,
      },
      geometry: {
        type: "LineString",
        coordinates: linkCoordinates,
      },
    });
  }

  return features;
};

const buildConnectCustomerPointsSourceData = (
  ephemeralState: EphemeralConnectCustomerPoints,
  assets: AssetsMap,
): Feature[] => {
  const features: Feature[] = [];

  if (ephemeralState.targetPipeId) {
    const pipe = assets.get(Number(ephemeralState.targetPipeId)) as LinkAsset;
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

  if (ephemeralState.nodeReplacementId) {
    const nodeToReplace = assets.get(
      Number(ephemeralState.nodeReplacementId),
    ) as NodeAsset;
    if (nodeToReplace && !nodeToReplace.isLink) {
      const properties: any = { halo: true };
      if (ephemeralState.nodeType !== "junction") {
        properties.icon = `${ephemeralState.nodeType}-highlight`;
      }

      features.push({
        type: "Feature",
        id: `node-replacement-${ephemeralState.nodeReplacementId}`,
        properties,
        geometry: {
          type: "Point",
          coordinates: nodeToReplace.coordinates,
        },
      });
    }
  }

  if (!ephemeralState.pipeSnappingPosition) return features;

  if (ephemeralState.pipeSnappingPosition && ephemeralState.pipeId) {
    const pipe = assets.get(Number(ephemeralState.pipeId)) as LinkAsset;
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

const buildAreaSelectionSourceData = (
  ephemeralState: EphemeralEditingStateAreaSelection,
): Feature[] => {
  if (ephemeralState.type !== "areaSelect") return [];
  if (ephemeralState.points.length < 2) return [];

  let polygonCoordinates: Position[] = [];
  let lineCoordinates: Position[] = [];

  switch (ephemeralState.selectionMode) {
    case Mode.SELECT_RECTANGULAR:
      polygonCoordinates = polygonCoordinatesFromPositions(
        ephemeralState.points[0],
        ephemeralState.points[1],
      )[0];
      lineCoordinates = polygonCoordinates;
      break;
    case Mode.SELECT_POLYGONAL:
    case Mode.SELECT_FREEHAND:
      // Create a polygon even with 2 points by duplicating the last point
      // This allows Mapbox to render it as a thin line-like shape
      const polygonPoints =
        ephemeralState.points.length === 2
          ? [...ephemeralState.points, ephemeralState.points[1]]
          : ephemeralState.points;

      polygonCoordinates = [...polygonPoints, polygonPoints[0]];
      lineCoordinates = polygonPoints;
      break;
  }

  const properties = {
    isSelection: true,
    isValid: ephemeralState.isValid,
    operation: ephemeralState.operation || "replace",
  };

  return [
    {
      type: "Feature",
      id: "selection-polygon",
      properties,
      geometry: {
        type: "Polygon",
        coordinates: [polygonCoordinates],
      },
    },
    {
      type: "Feature",
      id: "selection-outline",
      properties,
      geometry: {
        type: "LineString",
        coordinates: lineCoordinates,
      },
    },
  ];
};
