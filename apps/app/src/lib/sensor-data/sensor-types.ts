import type { AssetType } from "@epanet-js/hydraulic-model";
import type {
  JunctionProperty,
  PipeProperty,
  PumpProperty,
  ReservoirProperty,
  TankProperty,
  ValveProperty,
} from "@epanet-js/simulation";

type SensorTypesByAssetType = {
  junction: readonly JunctionProperty[];
  tank: readonly TankProperty[];
  reservoir: readonly ReservoirProperty[];
  pipe: readonly PipeProperty[];
  pump: readonly PumpProperty[];
  valve: readonly ValveProperty[];
};

export const SENSOR_TYPES_BY_ASSET_TYPE = {
  junction: ["pressure", "head", "demand"],
  tank: ["level", "volume", "netFlow", "pressure", "head"],
  reservoir: ["pressure", "head", "netFlow"],
  pipe: ["flow", "velocity", "headloss"],
  pump: ["flow", "head", "setting", "status"],
  valve: ["flow", "velocity", "headloss", "setting"],
} as const satisfies SensorTypesByAssetType;

export type SensorType = (typeof SENSOR_TYPES_BY_ASSET_TYPE)[AssetType][number];

export const sensorTypeFor = (
  assetType: AssetType,
  value: string,
): SensorType | undefined => {
  const normalized = value.trim().toLowerCase();
  const supported: readonly SensorType[] =
    SENSOR_TYPES_BY_ASSET_TYPE[assetType];
  return supported.find((type) => type.toLowerCase() === normalized);
};
