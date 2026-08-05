import {
  DEFAULT_MINOR_LOSS,
  DEFAULT_EMITTER_COEFFICIENT,
  DEFAULT_MIN_VOLUME,
  DEFAULT_MIXING_FRACTION,
  DEFAULT_SPEED,
  DEFAULT_INITIAL_QUALITY,
  type Asset,
  type Pipe,
} from "@epanet-js/hydraulic-model";
import type { HydraulicModel } from "src/hydraulic-model";
import { buildRoughnessInferrer } from "src/hydraulic-model/pipe-materials";

type FieldDefault = number | ((asset: Asset) => number | null);

export type ExportDefaults = Record<string, Record<string, FieldDefault>>;

export const OPTIONAL_FIELD_DEFAULTS: ExportDefaults = {
  pipe: { minorLoss: DEFAULT_MINOR_LOSS },
  valve: { minorLoss: DEFAULT_MINOR_LOSS },
  junction: {
    emitterCoefficient: DEFAULT_EMITTER_COEFFICIENT,
    initialQuality: DEFAULT_INITIAL_QUALITY,
  },
  reservoir: { initialQuality: DEFAULT_INITIAL_QUALITY },
  tank: {
    minVolume: DEFAULT_MIN_VOLUME,
    mixingFraction: DEFAULT_MIXING_FRACTION,
    initialQuality: DEFAULT_INITIAL_QUALITY,
  },
  pump: { speed: DEFAULT_SPEED },
};

export const buildExportDefaults = (
  hydraulicModel: HydraulicModel,
  { inferRoughness = false }: { inferRoughness?: boolean } = {},
): ExportDefaults => {
  if (!inferRoughness) return OPTIONAL_FIELD_DEFAULTS;

  const inferrer = buildRoughnessInferrer(hydraulicModel.pipeMaterials, {
    enabled: true,
  });

  return {
    ...OPTIONAL_FIELD_DEFAULTS,
    pipe: {
      ...OPTIONAL_FIELD_DEFAULTS.pipe,
      roughness: (asset) => inferrer(asset as Pipe),
    },
  };
};

export const resolveExportValue = <T>(
  asset: Asset,
  key: string,
  value: T,
  defaults: ExportDefaults = OPTIONAL_FIELD_DEFAULTS,
): T | number => {
  if (value !== null && value !== undefined) return value;

  const fieldDefault = defaultFor(defaults, asset, key);
  return fieldDefault !== undefined ? fieldDefault : value;
};

export const resolveExportProperties = (
  asset: Asset,
  properties: Record<string, unknown>,
  defaults: ExportDefaults = OPTIONAL_FIELD_DEFAULTS,
): Record<string, unknown> => {
  const fieldDefaults = defaults[asset.type];
  if (!fieldDefaults) return { ...properties };

  const resolved = { ...properties };
  for (const key of Object.keys(fieldDefaults)) {
    if (resolved[key] !== null && resolved[key] !== undefined) continue;

    const fieldDefault = defaultFor(defaults, asset, key);
    if (fieldDefault !== undefined) resolved[key] = fieldDefault;
  }
  return resolved;
};

const defaultFor = (
  defaults: ExportDefaults,
  asset: Asset,
  key: string,
): number | undefined => {
  const fieldDefault = defaults[asset.type]?.[key];
  if (fieldDefault === undefined) return undefined;
  if (typeof fieldDefault !== "function") return fieldDefault;

  return fieldDefault(asset) ?? undefined;
};
