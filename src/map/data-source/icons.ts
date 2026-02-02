import { AssetId, AssetsMap, Pipe, Pump, Reservoir } from "src/hydraulic-model";
import { Link, findLargestSegment } from "src/hydraulic-model/asset-types/link";
import { Feature } from "src/types";
import calculateMidpoint from "@turf/midpoint";
import calculateBearing from "@turf/bearing";
import { Valve } from "src/hydraulic-model/asset-types";
import { controlKinds } from "src/hydraulic-model/asset-types/valve";
import { Tank } from "src/hydraulic-model/asset-types/tank";
import type { ResultsReader } from "src/simulation/results-reader";

export const buildIconPointsSource = (
  assets: AssetsMap,
  selectedAssets: Set<AssetId>,
  simulationResults?: ResultsReader | null,
): Feature[] => {
  const strippedFeatures = [];

  for (const asset of assets.values()) {
    let feature: Feature | null = null;

    switch (asset.type) {
      case "pump":
        feature = buildPumpIcon(
          asset as Pump,
          selectedAssets,
          simulationResults,
        );
        break;
      case "valve":
        feature = buildValveIcon(
          asset as Valve,
          selectedAssets,
          simulationResults,
        );
        break;
      case "pipe":
        const pipe = asset as Pipe;
        if (pipe.initialStatus === "cv") {
          feature = buildPipeCheckValveIcon(
            pipe,
            selectedAssets,
            simulationResults,
          );
        }
        break;
      case "tank":
        feature = buildNodeIcon(asset as Tank, selectedAssets);
        break;
      case "reservoir":
        feature = buildNodeIcon(asset as Reservoir, selectedAssets);
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
  selectedAssets: Set<AssetId>,
  getIconProperties: (asset: T) => Record<string, any>,
): Feature => {
  const featureId = asset.id;
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
  selectedAssets: Set<AssetId>,
): Feature => {
  const featureId = asset.id;

  return {
    type: "Feature",
    id: featureId,
    properties: {
      type: asset.type,
      isActive: asset.isActive,
      selected: selectedAssets.has(asset.id),
    },
    geometry: asset.feature.geometry,
  };
};

const buildPumpIcon = (
  pump: Pump,
  selectedAssets: Set<AssetId>,
  simulationResults?: ResultsReader | null,
): Feature => {
  const pumpSimulation = simulationResults?.getPump(pump.id);
  const status = simulationResults
    ? (pumpSimulation?.status ?? null)
    : pump.status;
  return buildDirectionalLinkIcon(pump, selectedAssets, (asset) => ({
    status: status ? status : asset.initialStatus,
    isActive: asset.isActive,
  }));
};

const buildValveIcon = (
  valve: Valve,
  selectedAssets: Set<AssetId>,
  simulationResults?: ResultsReader | null,
): Feature => {
  const valveSimulation = simulationResults?.getValve(valve.id);
  const simStatus = simulationResults
    ? (valveSimulation?.status ?? null)
    : valve.status;
  const status = valve.isActive
    ? simStatus
      ? simStatus
      : valve.initialStatus
    : "disabled";
  return buildDirectionalLinkIcon(valve, selectedAssets, () => ({
    kind: valve.kind,
    icon: `valve-${valve.kind}-${status}`,
    isControlValve: controlKinds.includes(valve.kind),
  }));
};

const buildPipeCheckValveIcon = (
  pipe: Pipe,
  selectedAssets: Set<AssetId>,
  simulationResults?: ResultsReader | null,
): Feature => {
  const pipeSimulation = simulationResults?.getPipe(pipe.id);
  const simStatus = simulationResults
    ? (pipeSimulation?.status ?? null)
    : pipe.status;
  const status = pipe.isActive
    ? simStatus === "closed"
      ? "closed"
      : "open"
    : "disabled";
  return buildDirectionalLinkIcon(pipe, selectedAssets, () => ({
    icon: `pipe-cv-${status}`,
  }));
};
