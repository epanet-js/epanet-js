import { Feature, Position } from "src/types";
import { Asset, NodeAsset, LinkAsset } from "src/hydraulic-model/asset-types";
import { AssetsMap } from "src/hydraulic-model";
import {
  EphemeralEditingState,
  EphemeralConnectCustomerPoints,
  Mode,
} from "src/state/jotai";
import { EphemeralMoveAssets } from "../mode-handlers/none/move-state";
import { EphemeralDrawNode } from "../mode-handlers/draw-node/ephemeral-draw-node-state";
import { EphemeralDrawLink } from "../mode-handlers/draw-link/ephemeral-link-state";
import { EphemeralEditingStateAreaSelection } from "../mode-handlers/area-selection/ephemeral-area-selection-state";
import { polygonCoordinatesFromPositions } from "src/lib/geometry";

export const buildEphemeralStateSource = (
  ephemeralState: EphemeralEditingState,
  assets: AssetsMap,
): Feature[] => {
  if (ephemeralState.type == "drawLink") {
    return buildDrawLinkSourceData(ephemeralState, assets);
  }

  if (ephemeralState.type === "drawNode") {
    return buildDrawNodeSourceData(ephemeralState, assets);
  }

  if (ephemeralState.type === "moveAssets") {
    return buildMoveAssetsSourceData(ephemeralState, assets);
  }

  if (ephemeralState.type === "connectCustomerPoints") {
    return buildConnectCustomerPointsSourceData(ephemeralState, assets);
  }

  if (ephemeralState.type === "areaSelect") {
    return buildAreaSelectionSourceData(ephemeralState);
  }

  return [];
};

const buildMoveAssetsSourceData = (
  ephemeralState: EphemeralMoveAssets,
  assets: AssetsMap,
) => {
  const features: Feature[] = [];

  const iconProps = (asset: Asset) => {
    if (asset.isLink || asset.type === "junction") return {};

    return { icon: `${asset.type}-highlight` };
  };

  for (const asset of ephemeralState.targetAssets) {
    features.push({
      ...asset.feature,
      properties: {
        draft: true,
        ...iconProps(asset),
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

  return [
    {
      type: "Feature",
      id: "selection-polygon",
      properties: {
        isSelection: true,
        isValid: ephemeralState.isValid,
      },
      geometry: {
        type: "Polygon",
        coordinates: [polygonCoordinates],
      },
    },
    {
      type: "Feature",
      id: "selection-outline",
      properties: {
        isSelection: true,
        isValid: ephemeralState.isValid,
      },
      geometry: {
        type: "LineString",
        coordinates: lineCoordinates,
      },
    },
  ];
};
