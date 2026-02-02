import { AssetsMap, Asset, AssetId, Pipe, Pump } from "src/hydraulic-model";
import { Feature } from "src/types";
import { Sel, USelection } from "src/selection";
import { findLargestSegment, Link } from "src/hydraulic-model/asset-types/link";
import { Valve } from "src/hydraulic-model/asset-types";
import {
  buildFeatureId,
  appendPipeStatus,
  appendPumpStatus,
  appendValveStatus,
  appendPipeArrowProps,
} from "./features";
import type { ResultsReader } from "src/simulation/results-reader";

export const buildSelectionSource = (
  assets: AssetsMap,
  selection: Sel,
  movedAssetIds: Set<AssetId> = new Set(),
  simulationResults?: ResultsReader | null,
): Feature[] => {
  const selectedIds = USelection.toIds(selection);
  if (selectedIds.length === 0) {
    return [];
  }

  const features: Feature[] = [];

  for (let i = 0; i < selectedIds.length; i++) {
    const assetId = selectedIds[i];
    const asset = assets.get(assetId);

    if (!asset || asset.feature.properties?.visibility === false) {
      continue;
    }

    if (movedAssetIds.has(assetId)) {
      continue;
    }

    const featureId = buildFeatureId(assetId);

    if (asset.isLink) {
      features.push(
        buildLinkSelectionFeature(asset, featureId, simulationResults),
      );

      const needsIcon =
        asset.type === "pump" ||
        asset.type === "valve" ||
        (asset.type === "pipe" && (asset as any).initialStatus === "cv");

      if (needsIcon) {
        features.push(buildLinkIconSelectionFeature(asset, featureId));
      }
    } else {
      if (asset.type === "junction") {
        features.push(buildPointSelectionFeature(asset, featureId));
      } else {
        features.push(buildIconSelectionFeature(asset, featureId));
      }
    }
  }

  return features;
};

const buildLinkSelectionFeature = (
  asset: Asset,
  featureId: AssetId,
  simulationResults?: ResultsReader | null,
): Feature => {
  const feature: Feature = {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
      isActive: asset.isActive,
    },
    geometry: asset.feature.geometry,
  };

  switch (asset.type) {
    case "pipe":
      appendPipeStatus(asset as Pipe, feature, simulationResults);
      appendPipeArrowProps(asset as Pipe, feature, simulationResults);
      break;
    case "pump":
      appendPumpStatus(asset as Pump, feature, simulationResults);
      break;
    case "valve":
      appendValveStatus(asset as Valve, feature, simulationResults);
      break;
    default:
      break;
  }

  return feature;
};

const buildPointSelectionFeature = (
  asset: Asset,
  featureId: AssetId,
): Feature => {
  return {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
      isActive: asset.isActive,
    },
    geometry: asset.feature.geometry,
  };
};

const buildIconSelectionFeature = (
  asset: Asset,
  featureId: AssetId,
): Feature => {
  return {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
      isActive: asset.isActive,
      icon: true,
    },
    geometry: asset.feature.geometry,
  };
};

const buildLinkIconSelectionFeature = (
  asset: Asset,
  featureId: AssetId,
): Feature => {
  const linkAsset = asset as Link<any>;
  const largestSegment = findLargestSegment(linkAsset);

  // Fast midpoint calculation (avoid Turf overhead)
  const [[lon1, lat1], [lon2, lat2]] = largestSegment;
  const centerLon = (lon1 + lon2) / 2;
  const centerLat = (lat1 + lat2) / 2;

  return {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
      isActive: asset.isActive,
    },
    geometry: {
      type: "Point",
      coordinates: [centerLon, centerLat],
    },
  };
};
