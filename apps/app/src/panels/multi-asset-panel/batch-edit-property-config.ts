import { Asset } from "src/hydraulic-model";
import {
  pipeStatuses,
  pumpStatuses,
  tankMixingModels,
  valveStatuses,
  valveKinds,
  chemicalSourceTypes,
  type CurveType,
  type PatternType,
  DEFAULT_MINOR_LOSS,
  DEFAULT_EMITTER_COEFFICIENT,
  DEFAULT_MIN_VOLUME,
  DEFAULT_MIXING_FRACTION,
  DEFAULT_SPEED,
  DEFAULT_INITIAL_QUALITY,
} from "@epanet-js/hydraulic-model";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
import type { PaywallFeature } from "src/state/dialog";
import {
  isValidInstallationYear,
  isValidMaterial,
} from "src/hydraulic-model/property-validators";
import {
  isGreaterThanZero,
  isZeroOrGreater,
  isWithinUnitRange,
} from "src/components/form/numeric-input-utils";

type CommonConfig = {
  paywall?: PaywallFeature;
};

type QuantityConfig = CommonConfig & {
  fieldType: "quantity";
  modelProperty: ChangeableProperty;
  isNullable?: boolean;
  isOptional?: boolean;
  placeholder?: string;
  validate?: (value: number) => boolean;
  commitInvalidValues?: boolean;
  labelKey?: string;
};

type CategoryConfig = CommonConfig & {
  fieldType: "category";
  modelProperty: ChangeableProperty;
  statsPrefix: string;
  values: readonly string[];
  useUppercaseLabel?: boolean;
  nullLabelKey?: string;
};

type BooleanConfig = CommonConfig & {
  fieldType: "boolean";
  modelProperty: ChangeableProperty;
};

type LibrarySelectConfig = CommonConfig & {
  fieldType: "librarySelect";
  modelProperty: ChangeableProperty;
  library: "curves" | "patterns" | "pumps";
  filterByType?: CurveType | PatternType;
  nullLabelKey?: string;
  libraryLabelKey?: string;
};

type OpenCategoryConfig = CommonConfig & {
  fieldType: "openCategory";
  modelProperty: ChangeableProperty;
  nullLabelKey?: string;
  validateNew?: (query: string) => boolean;
};

export type BatchEditPropertyConfig =
  | QuantityConfig
  | CategoryConfig
  | BooleanConfig
  | LibrarySelectConfig
  | OpenCategoryConfig;

export type EditableProperties = Record<string, BatchEditPropertyConfig>;

export const BATCH_EDITABLE_PROPERTIES: Record<
  Asset["type"],
  Record<string, BatchEditPropertyConfig>
> = {
  junction: {
    elevation: {
      fieldType: "quantity",
      modelProperty: "elevation",
    },
    emitterCoefficient: {
      fieldType: "quantity",
      modelProperty: "emitterCoefficient",
      validate: isZeroOrGreater,
    },
    initialQuality: {
      fieldType: "quantity",
      modelProperty: "initialQuality",
      validate: isZeroOrGreater,
    },
    chemicalSourceType: {
      fieldType: "category",
      modelProperty: "chemicalSourceType",
      statsPrefix: "source.",
      values: chemicalSourceTypes,
      nullLabelKey: "none",
    },
    chemicalSourceStrength: {
      fieldType: "quantity",
      modelProperty: "chemicalSourceStrength",
      validate: isZeroOrGreater,
      isOptional: true,
      placeholder: "0",
    },
    chemicalSourcePattern: {
      fieldType: "librarySelect",
      modelProperty: "chemicalSourcePatternId",
      library: "patterns",
      filterByType: "qualitySourceStrength",
      nullLabelKey: "none",
      libraryLabelKey: "openPatternsLibrary",
    },
  },
  pipe: {
    isEnabled: { fieldType: "boolean", modelProperty: "isActive" },
    initialStatus: {
      fieldType: "category",
      modelProperty: "initialStatus",
      statsPrefix: "pipe.",
      values: pipeStatuses,
    },
    diameter: {
      fieldType: "quantity",
      modelProperty: "diameter",
      validate: isGreaterThanZero,
    },
    length: {
      fieldType: "quantity",
      modelProperty: "length",
      validate: isGreaterThanZero,
    },
    material: {
      fieldType: "openCategory",
      modelProperty: "material",
      paywall: "pipeAttributes",
      validateNew: isValidMaterial,
    },
    year: {
      fieldType: "quantity",
      modelProperty: "year",
      isOptional: true,
      validate: isValidInstallationYear,
      labelKey: "yearOfInstallation",
      paywall: "pipeAttributes",
    },
    roughness: {
      fieldType: "quantity",
      modelProperty: "roughness",
      validate: isGreaterThanZero,
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      validate: isZeroOrGreater,
    },
    bulkReactionCoeff: {
      fieldType: "quantity",
      modelProperty: "bulkReactionCoeff",
      isOptional: true,
    },
    wallReactionCoeff: {
      fieldType: "quantity",
      modelProperty: "wallReactionCoeff",
      isOptional: true,
    },
  },
  pump: {
    isEnabled: { fieldType: "boolean", modelProperty: "isActive" },
    initialStatus: {
      fieldType: "category",
      modelProperty: "initialStatus",
      statsPrefix: "pump.",
      values: pumpStatuses,
    },
    speed: {
      fieldType: "quantity",
      modelProperty: "speed",
      validate: isZeroOrGreater,
      labelKey: "initialSpeed",
    },
    speedPattern: {
      fieldType: "librarySelect",
      modelProperty: "speedPatternId",
      library: "patterns",
      filterByType: "pumpSpeed",
      nullLabelKey: "constant",
      libraryLabelKey: "openPatternsLibrary",
    },
    efficiencyCurve: {
      fieldType: "librarySelect",
      modelProperty: "efficiencyCurveId",
      library: "pumps",
      filterByType: "efficiency",
      nullLabelKey: "none",
      libraryLabelKey: "openPumpLibrary",
    },
    energyPrice: {
      fieldType: "quantity",
      modelProperty: "energyPrice",
      validate: isZeroOrGreater,
      isOptional: true,
    },
    energyPricePattern: {
      fieldType: "librarySelect",
      modelProperty: "energyPricePatternId",
      library: "patterns",
      filterByType: "energyPrice",
      nullLabelKey: "constant",
      libraryLabelKey: "openPatternsLibrary",
    },
  },
  valve: {
    isEnabled: { fieldType: "boolean", modelProperty: "isActive" },
    valveType: {
      fieldType: "category",
      modelProperty: "kind",
      statsPrefix: "valve.",
      values: valveKinds,
      useUppercaseLabel: true,
    },
    setting: {
      fieldType: "quantity",
      modelProperty: "setting",
    },
    initialStatus: {
      fieldType: "category",
      modelProperty: "initialStatus",
      statsPrefix: "valve.",
      values: valveStatuses,
    },
    diameter: {
      fieldType: "quantity",
      modelProperty: "diameter",
      validate: isGreaterThanZero,
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      validate: isZeroOrGreater,
    },
  },
  reservoir: {
    elevation: {
      fieldType: "quantity",
      modelProperty: "elevation",
    },
    headPattern: {
      fieldType: "librarySelect",
      modelProperty: "headPatternId",
      library: "patterns",
      nullLabelKey: "constant",
      libraryLabelKey: "openPatternsLibrary",
    },
    initialQuality: {
      fieldType: "quantity",
      modelProperty: "initialQuality",
      validate: isZeroOrGreater,
    },
    chemicalSourceType: {
      fieldType: "category",
      modelProperty: "chemicalSourceType",
      statsPrefix: "source.",
      values: chemicalSourceTypes,
      nullLabelKey: "none",
    },
    chemicalSourceStrength: {
      fieldType: "quantity",
      modelProperty: "chemicalSourceStrength",
      validate: isZeroOrGreater,
      isOptional: true,
      placeholder: "0",
    },
    chemicalSourcePattern: {
      fieldType: "librarySelect",
      modelProperty: "chemicalSourcePatternId",
      library: "patterns",
      filterByType: "qualitySourceStrength",
      nullLabelKey: "none",
      libraryLabelKey: "openPatternsLibrary",
    },
  },
  tank: {
    elevation: {
      fieldType: "quantity",
      modelProperty: "elevation",
    },
    initialLevel: {
      fieldType: "quantity",
      modelProperty: "initialLevel",
      validate: isZeroOrGreater,
    },
    minLevel: {
      fieldType: "quantity",
      modelProperty: "minLevel",
      validate: isZeroOrGreater,
    },
    maxLevel: {
      fieldType: "quantity",
      modelProperty: "maxLevel",
      validate: isGreaterThanZero,
    },
    diameter: {
      fieldType: "quantity",
      modelProperty: "diameter",
      validate: isGreaterThanZero,
    },
    minVolume: {
      fieldType: "quantity",
      modelProperty: "minVolume",
      validate: isZeroOrGreater,
    },
    canOverflow: { fieldType: "boolean", modelProperty: "overflow" },
    initialQuality: {
      fieldType: "quantity",
      modelProperty: "initialQuality",
      validate: isZeroOrGreater,
    },
    mixingModel: {
      fieldType: "category",
      modelProperty: "mixingModel",
      statsPrefix: "tank.",
      values: tankMixingModels,
    },
    mixingFraction: {
      fieldType: "quantity",
      modelProperty: "mixingFraction",
      validate: isWithinUnitRange,
    },
    bulkReactionCoeff: {
      fieldType: "quantity",
      modelProperty: "bulkReactionCoeff",
      isOptional: true,
    },
    chemicalSourceType: {
      fieldType: "category",
      modelProperty: "chemicalSourceType",
      statsPrefix: "source.",
      values: chemicalSourceTypes,
      nullLabelKey: "none",
    },
    chemicalSourceStrength: {
      fieldType: "quantity",
      modelProperty: "chemicalSourceStrength",
      validate: isZeroOrGreater,
      isOptional: true,
      placeholder: "0",
    },
    chemicalSourcePattern: {
      fieldType: "librarySelect",
      modelProperty: "chemicalSourcePatternId",
      library: "patterns",
      filterByType: "qualitySourceStrength",
      nullLabelKey: "none",
      libraryLabelKey: "openPatternsLibrary",
    },
  },
};

const NULLABLE_BATCH_KEYS = new Set([
  "roughness",
  "head",
  "initialLevel",
  "setting",
  "diameter",
]);

const FLAG_OPTIONAL_BATCH_KEYS = new Set([
  "minorLoss",
  "emitterCoefficient",
  "minVolume",
  "mixingFraction",
  "speed",
  "initialQuality",
]);

const ALWAYS_OPTIONAL_VALIDATED_KEYS = new Set([
  "energyPrice",
  "chemicalSourceStrength",
]);

// EPANET default shown as a placeholder for an empty optional field.
const optionalFieldPlaceholder = (key: string): string | undefined => {
  switch (key) {
    case "minorLoss":
      return String(DEFAULT_MINOR_LOSS);
    case "emitterCoefficient":
      return String(DEFAULT_EMITTER_COEFFICIENT);
    case "minVolume":
      return String(DEFAULT_MIN_VOLUME);
    case "mixingFraction":
      return String(DEFAULT_MIXING_FRACTION);
    case "speed":
      return String(DEFAULT_SPEED);
    case "initialQuality":
      return String(DEFAULT_INITIAL_QUALITY);
    default:
      return undefined;
  }
};

export const withNullableProperties = (
  properties: EditableProperties,
  allowsNullValues: boolean,
  assetType?: Asset["type"],
): EditableProperties => {
  if (!allowsNullValues) return properties;
  const result: EditableProperties = {};
  for (const [key, config] of Object.entries(properties)) {
    const nullable =
      NULLABLE_BATCH_KEYS.has(key) &&
      !(key === "diameter" && assetType === "pipe");
    // The base config's `validate` stays the single authority. The flag only
    // makes a failing value warn-and-commit instead of blocking
    // (`commitInvalidValues`), and relaxes empty handling (nullable/optional).
    if (config.fieldType === "quantity" && nullable) {
      result[key] = { ...config, isNullable: true, commitInvalidValues: true };
    } else if (
      config.fieldType === "quantity" &&
      FLAG_OPTIONAL_BATCH_KEYS.has(key)
    ) {
      // Show the EPANET default as a placeholder when not in a mixed situation.
      result[key] = {
        ...config,
        isOptional: true,
        placeholder: optionalFieldPlaceholder(key) ?? config.placeholder,
        commitInvalidValues: true,
      };
    } else if (
      config.fieldType === "quantity" &&
      ALWAYS_OPTIONAL_VALIDATED_KEYS.has(key)
    ) {
      // Already optional in the base config; the flag only flips its sign check
      // from blocking to informational.
      result[key] = { ...config, commitInvalidValues: true };
    } else {
      result[key] = config;
    }
  }
  return result;
};
