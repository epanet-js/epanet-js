import type { AssetType } from "@epanet-js/hydraulic-model";
import type {
  JunctionProperty,
  PipeProperty,
  PumpProperty,
  ReservoirProperty,
  TankProperty,
  ValveProperty,
} from "@epanet-js/simulation";

type ParametersByAssetType = {
  junction: readonly JunctionProperty[];
  tank: readonly TankProperty[];
  reservoir: readonly ReservoirProperty[];
  pipe: readonly PipeProperty[];
  pump: readonly PumpProperty[];
  valve: readonly ValveProperty[];
};

export const PARAMETERS_BY_ASSET_TYPE = {
  junction: ["pressure", "head", "demand"],
  tank: ["level", "volume", "netFlow", "pressure", "head"],
  reservoir: ["pressure", "head", "netFlow"],
  pipe: ["flow", "velocity", "headloss"],
  pump: ["flow", "head", "setting", "status"],
  valve: ["flow", "velocity", "headloss", "setting"],
} as const satisfies ParametersByAssetType;

export type SensorParameter =
  (typeof PARAMETERS_BY_ASSET_TYPE)[AssetType][number];

export const ASSET_TYPES = Object.keys(PARAMETERS_BY_ASSET_TYPE) as AssetType[];

export type SensorVocabulary = {
  parameters: Partial<
    Record<AssetType, Partial<Record<SensorParameter, readonly string[]>>>
  >;
  assetTypes: Partial<Record<AssetType, readonly string[]>>;
};

export const EMPTY_VOCABULARY: SensorVocabulary = {
  parameters: {},
  assetTypes: {},
};

const normalize = (value: string) => value.trim().toLowerCase();

const isNamed = (
  value: string,
  key: string,
  aliases: readonly string[] = [],
) => {
  const normalized = normalize(value);
  return [key, ...aliases].some(
    (candidate) => normalize(candidate) === normalized,
  );
};

export const parameterFor = (
  assetType: AssetType,
  value: string,
  vocabulary: SensorVocabulary = EMPTY_VOCABULARY,
): SensorParameter | undefined => {
  const supported: readonly SensorParameter[] =
    PARAMETERS_BY_ASSET_TYPE[assetType];
  const aliases = vocabulary.parameters[assetType] ?? {};
  return supported.find((parameter) =>
    isNamed(value, parameter, aliases[parameter]),
  );
};

export const assetTypeFor = (
  value: string,
  vocabulary: SensorVocabulary = EMPTY_VOCABULARY,
): AssetType | undefined =>
  ASSET_TYPES.find((assetType) =>
    isNamed(value, assetType, vocabulary.assetTypes[assetType]),
  );
