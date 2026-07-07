import {
  DEFAULT_MINOR_LOSS,
  DEFAULT_EMITTER_COEFFICIENT,
  DEFAULT_MIN_VOLUME,
  DEFAULT_MIXING_FRACTION,
  DEFAULT_SPEED,
  DEFAULT_INITIAL_QUALITY,
} from "@epanet-js/hydraulic-model";

export const OPTIONAL_FIELD_DEFAULTS: Record<string, Record<string, number>> = {
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

export const resolveExportValue = <T>(
  assetType: string,
  key: string,
  value: T,
): T | number => {
  if (value !== null && value !== undefined) return value;

  const fieldDefault = OPTIONAL_FIELD_DEFAULTS[assetType]?.[key];
  return fieldDefault !== undefined ? fieldDefault : value;
};

export const resolveExportProperties = (
  assetType: string,
  properties: Record<string, unknown>,
): Record<string, unknown> => {
  const fieldDefaults = OPTIONAL_FIELD_DEFAULTS[assetType];
  if (!fieldDefaults) return { ...properties };

  const resolved = { ...properties };
  for (const key of Object.keys(fieldDefaults)) {
    if (resolved[key] === null || resolved[key] === undefined) {
      resolved[key] = fieldDefaults[key];
    }
  }
  return resolved;
};
