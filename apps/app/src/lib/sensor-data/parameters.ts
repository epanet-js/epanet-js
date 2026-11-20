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

export const SENSOR_HEADERS = ["sensor", "parameter", "asset", "type"] as const;

export type SensorHeader = (typeof SENSOR_HEADERS)[number];

export type SensorVocabulary = {
  parameters: Partial<
    Record<AssetType, Partial<Record<SensorParameter, readonly string[]>>>
  >;
  assetTypes: Partial<Record<AssetType, readonly string[]>>;
  headers: Partial<Record<SensorHeader, readonly string[]>>;
};

export const EMPTY_VOCABULARY: SensorVocabulary = {
  parameters: {},
  assetTypes: {},
  headers: {},
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

export const headerFor = (
  value: string,
  vocabulary: SensorVocabulary = EMPTY_VOCABULARY,
): SensorHeader | undefined =>
  SENSOR_HEADERS.find((header) =>
    isNamed(value, header, vocabulary.headers[header]),
  );

const withAliases = (
  entries: readonly (readonly [string, readonly string[] | undefined])[],
): string[] => {
  const seen = new Set<string>();
  const words: string[] = [];
  for (const [key, aliases] of entries) {
    for (const word of [key, ...(aliases ?? [])]) {
      const normalized = normalize(word);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      words.push(word);
    }
  }
  return words;
};

export const acceptedHeaders = (
  vocabulary: SensorVocabulary = EMPTY_VOCABULARY,
): string[] =>
  withAliases(
    SENSOR_HEADERS.map((header) => [header, vocabulary.headers[header]]),
  );

export const acceptedAssetTypes = (
  vocabulary: SensorVocabulary = EMPTY_VOCABULARY,
): string[] =>
  withAliases(
    ASSET_TYPES.map((assetType) => [
      assetType,
      vocabulary.assetTypes[assetType],
    ]),
  );

export const acceptedParameters = (
  assetType: AssetType,
  vocabulary: SensorVocabulary = EMPTY_VOCABULARY,
): string[] => {
  const supported: readonly SensorParameter[] =
    PARAMETERS_BY_ASSET_TYPE[assetType];
  const aliases = vocabulary.parameters[assetType] ?? {};
  return withAliases(
    supported.map((parameter) => [parameter, aliases[parameter]]),
  );
};
