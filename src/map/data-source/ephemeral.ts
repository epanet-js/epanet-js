import { IDMap } from "src/lib/id-mapper";
import { Feature } from "src/types";
import { Asset, NodeAsset } from "src/hydraulic-model/asset-types";
import {
  EphemeralEditingState,
  EphemeralCustomerPointsHighlight,
} from "src/state/jotai";
import { EphemeralDrawLink } from "../mode-handlers/draw-link";
import { EphemeralMoveAssets } from "../mode-handlers/none/move-state";

export const buildEphemeralStateSource = (
  ephemeralState: EphemeralEditingState,
  _idMap: IDMap,
): Feature[] => {
  if (ephemeralState.type == "drawLink") {
    return buildDrawLinkSourceData(ephemeralState);
  }

  if (ephemeralState.type === "moveAssets") {
    return buildMoveAssetsSourceData(ephemeralState);
  }

  if (ephemeralState.type === "customerPointsHighlight") {
    return buildCustomerPointsHighlightSourceData(ephemeralState);
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

const buildCustomerPointsHighlightSourceData = (
  ephemeralState: EphemeralCustomerPointsHighlight,
) => {
  const features: Feature[] = [];

  for (const customerPoint of ephemeralState.customerPoints) {
    features.push({
      type: "Feature",
      id: `customer-point-halo-${customerPoint.id}`,
      properties: {
        halo: true,
      } as any,
      geometry: {
        type: "Point",
        coordinates: customerPoint.coordinates,
      },
    });
  }

  return features;
};

const buildDrawLinkSourceData = (
  ephemeralState: EphemeralDrawLink,
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
