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
  validate?: (value: number) => boolean;
  hasModelValidation?: boolean;
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
      hasModelValidation: true,
    },
    initialQuality: {
      fieldType: "quantity",
      modelProperty: "initialQuality",
      validate: isZeroOrGreater,
      hasModelValidation: true,
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
      hasModelValidation: true,
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
      validate: isValidInstallationYear,
      labelKey: "yearOfInstallation",
      paywall: "pipeAttributes",
    },
    roughness: {
      fieldType: "quantity",
      modelProperty: "roughness",
      validate: isGreaterThanZero,
      hasModelValidation: true,
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      validate: isZeroOrGreater,
      hasModelValidation: true,
    },
    bulkReactionCoeff: {
      fieldType: "quantity",
      modelProperty: "bulkReactionCoeff",
    },
    wallReactionCoeff: {
      fieldType: "quantity",
      modelProperty: "wallReactionCoeff",
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
      hasModelValidation: true,
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
      hasModelValidation: true,
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
      hasModelValidation: true,
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
      hasModelValidation: true,
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      validate: isZeroOrGreater,
      hasModelValidation: true,
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
      hasModelValidation: true,
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
      hasModelValidation: true,
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
      hasModelValidation: true,
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
      hasModelValidation: true,
    },
    minVolume: {
      fieldType: "quantity",
      modelProperty: "minVolume",
      validate: isZeroOrGreater,
      hasModelValidation: true,
    },
    canOverflow: { fieldType: "boolean", modelProperty: "overflow" },
    initialQuality: {
      fieldType: "quantity",
      modelProperty: "initialQuality",
      validate: isZeroOrGreater,
      hasModelValidation: true,
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
      hasModelValidation: true,
    },
    bulkReactionCoeff: {
      fieldType: "quantity",
      modelProperty: "bulkReactionCoeff",
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
      hasModelValidation: true,
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

// A default always applies when empty, so these are optional regardless of the
// null-values flag (mirrors the data table's OPTIONAL_KEYS).
const OPTIONAL_KEYS = new Set<string>([
  "bulkReactionCoeff",
  "wallReactionCoeff",
  "energyPrice",
  "chemicalSourceStrength",
  "year",
]);

// Required in strict mode, but optional when the null-values flag is on
// (mirrors the data table's FLAG_OPTIONAL_KEYS).
const FLAG_OPTIONAL_KEYS = new Set<string>([
  "minorLoss",
  "emitterCoefficient",
  "minVolume",
  "mixingFraction",
  "speed",
  "initialQuality",
]);

export const isOptionalProperty = (
  modelProperty: string,
  allowsNullValues: boolean,
): boolean =>
  OPTIONAL_KEYS.has(modelProperty) ||
  (allowsNullValues && FLAG_OPTIONAL_KEYS.has(modelProperty));
