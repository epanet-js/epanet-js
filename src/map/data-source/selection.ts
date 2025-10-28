import { AssetsMap, Asset, AssetId, Pipe, Pump } from "src/hydraulic-model";
import { IDMap } from "src/lib/id-mapper";
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

export const buildSelectionSource = (
  assets: AssetsMap,
  idMap: IDMap,
  selection: Sel,
  movedAssetIds: Set<AssetId> = new Set(),
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

    const featureId = buildFeatureId(idMap, assetId);

    if (asset.isLink) {
      features.push(buildLinkSelectionFeature(asset, featureId));

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

const buildLinkSelectionFeature = (asset: Asset, featureId: RawId): Feature => {
  const feature: Feature = {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
    },
    geometry: asset.feature.geometry,
  };

  switch (asset.type) {
    case "pipe":
      appendPipeStatus(asset as Pipe, feature);
      appendPipeArrowProps(asset as Pipe, feature);
      break;
    case "pump":
      appendPumpStatus(asset as Pump, feature);
      break;
    case "valve":
      appendValveStatus(asset as Valve, feature);
      break;
    default:
      break;
  }

  return feature;
};

const buildPointSelectionFeature = (
  asset: Asset,
  featureId: RawId,
): Feature => {
  return {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
    },
    geometry: asset.feature.geometry,
  };
};

const buildIconSelectionFeature = (asset: Asset, featureId: RawId): Feature => {
  return {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
      icon: getAssetIconName(asset),
    },
    geometry: asset.feature.geometry,
  };
};

const buildLinkIconSelectionFeature = (
  asset: Asset,
  featureId: RawId,
): Feature => {
  const linkAsset = asset as Link<any>;
  const largestSegment = findLargestSegment(linkAsset);

  // Fast midpoint calculation (avoid Turf overhead)
  const [[lon1, lat1], [lon2, lat2]] = largestSegment;
  const centerLon = (lon1 + lon2) / 2;
  const centerLat = (lat1 + lat2) / 2;

  // Fast bearing calculation (avoid Turf overhead)
  // Formula: θ = atan2(sin(Δlong).cos(lat2), cos(lat1).sin(lat2) − sin(lat1).cos(lat2).cos(Δlong))
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const lat1Rad = (lat1 * Math.PI) / 180;
  const lat2Rad = (lat2 * Math.PI) / 180;

  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x =
    Math.cos(lat1Rad) * Math.sin(lat2Rad) -
    Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
      icon: getAssetIconName(asset),
      rotation: bearing,
    },
    geometry: {
      type: "Point",
      coordinates: [centerLon, centerLat],
    },
  };
};

const getAssetIconName = (asset: Asset): string => {
  switch (asset.type) {
    case "pump":
      return "pump-highlight";
    case "valve":
      return "valve-highlight";
    case "tank":
      return "tank-highlight";
    case "reservoir":
      return "reservoir-highlight";
    case "pipe":
      return "check-valve-highlight";
    default:
      return `${asset.type}-highlight`;
  }
};
