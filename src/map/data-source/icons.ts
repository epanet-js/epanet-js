import { AssetId, AssetsMap, Pump, Reservoir } from "src/hydraulic-model";
import { findLargestSegment } from "src/hydraulic-model/asset-types/link";
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
    if (asset.type === "pump") {
      const pump = asset as Pump;
      const featureId = UIDMap.getIntID(idMap, asset.id);
      const largestSegment = findLargestSegment(pump);
      const center = calculateMidpoint(...largestSegment);
      const bearing = calculateBearing(...largestSegment);

      const feature: Feature = {
        type: "Feature",
        id: featureId,
        properties: {
          type: pump.type,
          status: pump.status ? pump.status : pump.initialStatus,
          rotation: bearing,
          selected: selectedAssets.has(pump.id),
        },
        geometry: {
          type: "Point",
          coordinates: center.geometry.coordinates,
        },
      };
      strippedFeatures.push(feature);
    }

    if (asset.type === "valve") {
      const valve = asset as Valve;
      const featureId = UIDMap.getIntID(idMap, asset.id);
      const largestSegment = findLargestSegment(valve);
      const center = calculateMidpoint(...largestSegment);
      const bearing = calculateBearing(...largestSegment);

      const status = valve.status ? valve.status : valve.initialStatus;

      const feature: Feature = {
        type: "Feature",
        id: featureId,
        properties: {
          type: valve.type,
          kind: valve.kind,
          icon: `valve-${valve.kind}-${status}`,
          rotation: bearing,
          selected: selectedAssets.has(valve.id),
          isControlValve: controlKinds.includes(valve.kind),
        },
        geometry: {
          type: "Point",
          coordinates: center.geometry.coordinates,
        },
      };
      strippedFeatures.push(feature);
    }

    if (asset.type === "tank") {
      const tank = asset as Tank;
      const featureId = UIDMap.getIntID(idMap, asset.id);

      const feature: Feature = {
        type: "Feature",
        id: featureId,
        properties: {
          type: tank.type,
          selected: selectedAssets.has(tank.id),
        },
        geometry: tank.feature.geometry,
      };
      strippedFeatures.push(feature);
    }

    if (asset.type === "reservoir") {
      const reservoir = asset as Reservoir;
      const featureId = UIDMap.getIntID(idMap, asset.id);

      const feature: Feature = {
        type: "Feature",
        id: featureId,
        properties: {
          type: reservoir.type,
          selected: selectedAssets.has(reservoir.id),
        },
        geometry: reservoir.feature.geometry,
      };
      strippedFeatures.push(feature);
    }
  }
  return strippedFeatures;
};
