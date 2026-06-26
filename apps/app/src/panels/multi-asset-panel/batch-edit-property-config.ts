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
} from "@epanet-js/hydraulic-model";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
import type { PaywallFeature } from "src/state/dialog";
import {
  isValidInstallationYear,
  isGreaterThanZero,
  isValidMaterial,
} from "src/hydraulic-model/property-validators";

type CommonConfig = {
  paywall?: PaywallFeature;
};

type QuantityConfig = CommonConfig & {
  fieldType: "quantity";
  modelProperty: ChangeableProperty;
  positiveOnly?: boolean;
  isNullable?: boolean;
  isOptional?: boolean;
  placeholder?: string;
  validate?: (value: number) => boolean;
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
      positiveOnly: true,
    },
    initialQuality: {
      fieldType: "quantity",
      modelProperty: "initialQuality",
      positiveOnly: true,
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
      positiveOnly: true,
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
      positiveOnly: true,
      validate: isGreaterThanZero,
    },
    length: {
      fieldType: "quantity",
      modelProperty: "length",
      positiveOnly: true,
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
      positiveOnly: true,
      isOptional: true,
      validate: isValidInstallationYear,
      labelKey: "yearOfInstallation",
      paywall: "pipeAttributes",
    },
    roughness: {
      fieldType: "quantity",
      modelProperty: "roughness",
      positiveOnly: true,
      validate: isGreaterThanZero,
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      positiveOnly: true,
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
      positiveOnly: true,
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
      positiveOnly: true,
      validate: isGreaterThanZero,
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      positiveOnly: true,
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
      positiveOnly: true,
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
      positiveOnly: true,
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
      positiveOnly: true,
    },
    minLevel: {
      fieldType: "quantity",
      modelProperty: "minLevel",
      positiveOnly: true,
    },
    maxLevel: {
      fieldType: "quantity",
      modelProperty: "maxLevel",
      positiveOnly: true,
      validate: isGreaterThanZero,
    },
    diameter: {
      fieldType: "quantity",
      modelProperty: "diameter",
      positiveOnly: true,
      validate: isGreaterThanZero,
    },
    minVolume: {
      fieldType: "quantity",
      modelProperty: "minVolume",
      positiveOnly: true,
    },
    canOverflow: { fieldType: "boolean", modelProperty: "overflow" },
    initialQuality: {
      fieldType: "quantity",
      modelProperty: "initialQuality",
      positiveOnly: true,
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
      positiveOnly: true,
      validate: isGreaterThanZero,
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
      positiveOnly: true,
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

// Numeric attributes that may be left empty (null) when the null-values feature
// is on. Required ones are enforced by the pre-simulation check instead
// (lib/model-attributes-validation). Mirror of NULLABLE_KEYS in the data table.
// First batch: simulation-only + panel-only required attributes. "diameter" is
// gated to non-pipe types (pipe diameter is deferred).
const NULLABLE_BATCH_KEYS = new Set([
  "roughness",
  "head",
  "initialLevel",
  "setting",
  "diameter",
]);

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
    result[key] =
      config.fieldType === "quantity" && nullable
        ? { ...config, isNullable: true }
        : config;
  }
  return result;
};
