import { AssetId, AssetsMap, Pipe, Pump, Reservoir } from "src/hydraulic-model";
import { Link, findLargestSegment } from "src/hydraulic-model/asset-types/link";
import { IDMap, UIDMap } from "src/lib/id-mapper";
import { Feature } from "src/types";
import calculateMidpoint from "@turf/midpoint";
import calculateBearing from "@turf/bearing";
import { Valve } from "src/hydraulic-model/asset-types";
import { controlKinds } from "src/hydraulic-model/asset-types/valve";
import { Tank } from "src/hydraulic-model/asset-types/tank";

export const buildIconPointsSource = (
  assets: AssetsMap,
  idMap: IDMap,
  selectedAssets: Set<AssetId>,
): Feature[] => {
  const strippedFeatures = [];

  for (const asset of assets.values()) {
    let feature: Feature | null = null;

    switch (asset.type) {
      case "pump":
        feature = buildPumpIcon(asset as Pump, idMap, selectedAssets);
        break;
      case "valve":
        feature = buildValveIcon(asset as Valve, idMap, selectedAssets);
        break;
      case "pipe":
        const pipe = asset as Pipe;
        if (pipe.initialStatus === "cv") {
          feature = buildPipeCheckValveIcon(pipe, idMap, selectedAssets);
        }
        break;
      case "tank":
        feature = buildNodeIcon(asset as Tank, idMap, selectedAssets);
        break;
      case "reservoir":
        feature = buildNodeIcon(asset as Reservoir, idMap, selectedAssets);
        break;
      case "junction":
        break;
    }

    if (feature) {
      strippedFeatures.push(feature);
    }
  }

  return strippedFeatures;
};

const buildDirectionalLinkIcon = <T extends Link<any>>(
  asset: T,
  idMap: IDMap,
  selectedAssets: Set<AssetId>,
  getIconProperties: (asset: T) => Record<string, any>,
): Feature => {
  const featureId = UIDMap.getIntID(idMap, asset.id);
  const largestSegment = findLargestSegment(asset);
  const center = calculateMidpoint(...largestSegment);
  const bearing = calculateBearing(...largestSegment);

  return {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
      rotation: bearing,
      selected: selectedAssets.has(asset.id),
      ...getIconProperties(asset),
    },
    geometry: {
      type: "Point",
      coordinates: center.geometry.coordinates,
    },
  };
};

const buildNodeIcon = (
  asset: Tank | Reservoir,
  idMap: IDMap,
  selectedAssets: Set<AssetId>,
): Feature => {
  const featureId = UIDMap.getIntID(idMap, asset.id);

  return {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
      selected: selectedAssets.has(asset.id),
    },
    geometry: asset.feature.geometry,
  };
};

const buildPumpIcon = (
  pump: Pump,
  idMap: IDMap,
  selectedAssets: Set<AssetId>,
): Feature => {
  return buildDirectionalLinkIcon(pump, idMap, selectedAssets, (asset) => ({
    status: asset.status ? asset.status : asset.initialStatus,
  }));
};

const buildValveIcon = (
  valve: Valve,
  idMap: IDMap,
  selectedAssets: Set<AssetId>,
): Feature => {
  const status = valve.status ? valve.status : valve.initialStatus;
  return buildDirectionalLinkIcon(valve, idMap, selectedAssets, () => ({
    kind: valve.kind,
    icon: `valve-${valve.kind}-${status}`,
    isControlValve: controlKinds.includes(valve.kind),
  }));
};

const buildPipeCheckValveIcon = (
  pipe: Pipe,
  idMap: IDMap,
  selectedAssets: Set<AssetId>,
): Feature => {
  const status = pipe.status === "closed" ? "closed" : "open";
  return buildDirectionalLinkIcon(pipe, idMap, selectedAssets, () => ({
    icon: `pipe-cv-${status}`,
  }));
};
