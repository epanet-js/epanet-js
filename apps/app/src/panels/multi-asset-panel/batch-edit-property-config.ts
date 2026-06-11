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
      isNullable: false,
    },
    emitterCoefficient: {
      fieldType: "quantity",
      modelProperty: "emitterCoefficient",
      positiveOnly: true,
      isNullable: false,
    },
    initialQuality: {
      fieldType: "quantity",
      modelProperty: "initialQuality",
      positiveOnly: true,
      isNullable: false,
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
      isNullable: true,
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
      isNullable: false,
      validate: isGreaterThanZero,
    },
    length: {
      fieldType: "quantity",
      modelProperty: "length",
      positiveOnly: true,
      isNullable: false,
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
      isNullable: true,
      validate: isValidInstallationYear,
      labelKey: "yearOfInstallation",
      paywall: "pipeAttributes",
    },
    roughness: {
      fieldType: "quantity",
      modelProperty: "roughness",
      positiveOnly: true,
      isNullable: false,
      validate: isGreaterThanZero,
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      positiveOnly: true,
      isNullable: false,
    },
    bulkReactionCoeff: {
      fieldType: "quantity",
      modelProperty: "bulkReactionCoeff",
      isNullable: true,
    },
    wallReactionCoeff: {
      fieldType: "quantity",
      modelProperty: "wallReactionCoeff",
      isNullable: true,
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
      isNullable: false,
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
      isNullable: true,
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
      isNullable: false,
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
      isNullable: false,
      validate: isGreaterThanZero,
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      positiveOnly: true,
      isNullable: false,
    },
  },
  reservoir: {
    elevation: {
      fieldType: "quantity",
      modelProperty: "elevation",
      isNullable: false,
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
      isNullable: false,
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
      isNullable: true,
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
      isNullable: false,
    },
    initialLevel: {
      fieldType: "quantity",
      modelProperty: "initialLevel",
      positiveOnly: true,
      isNullable: false,
    },
    minLevel: {
      fieldType: "quantity",
      modelProperty: "minLevel",
      positiveOnly: true,
      isNullable: false,
    },
    maxLevel: {
      fieldType: "quantity",
      modelProperty: "maxLevel",
      positiveOnly: true,
      isNullable: false,
      validate: isGreaterThanZero,
    },
    diameter: {
      fieldType: "quantity",
      modelProperty: "diameter",
      positiveOnly: true,
      isNullable: false,
      validate: isGreaterThanZero,
    },
    minVolume: {
      fieldType: "quantity",
      modelProperty: "minVolume",
      positiveOnly: true,
      isNullable: false,
    },
    canOverflow: { fieldType: "boolean", modelProperty: "overflow" },
    initialQuality: {
      fieldType: "quantity",
      modelProperty: "initialQuality",
      positiveOnly: true,
      isNullable: false,
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
      isNullable: false,
      validate: isGreaterThanZero,
    },
    bulkReactionCoeff: {
      fieldType: "quantity",
      modelProperty: "bulkReactionCoeff",
      isNullable: true,
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
      isNullable: true,
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
