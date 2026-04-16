import { Asset } from "src/hydraulic-model";
import { pipeStatuses } from "src/hydraulic-model/asset-types/pipe";
import { pumpStatuses } from "src/hydraulic-model/asset-types/pump";
import { tankMixingModels } from "src/hydraulic-model/asset-types/tank";
import {
  valveStatuses,
  valveKinds,
} from "src/hydraulic-model/asset-types/valve";
import { chemicalSourceTypes } from "src/hydraulic-model/asset-types/node";
import type { ChangeableProperty } from "src/hydraulic-model/model-operations/change-property";
import type { CurveType } from "src/hydraulic-model/curves";
import type { PatternType } from "src/hydraulic-model/patterns";

type QuantityConfig = {
  fieldType: "quantity";
  modelProperty: ChangeableProperty;
  positiveOnly?: boolean;
  isNullable?: boolean;
};

type CategoryConfig = {
  fieldType: "category";
  modelProperty: ChangeableProperty;
  statsPrefix: string;
  values: readonly string[];
  useUppercaseLabel?: boolean;
};

type BooleanConfig = {
  fieldType: "boolean";
  modelProperty: ChangeableProperty;
};

type LibrarySelectConfig = {
  fieldType: "librarySelect";
  modelProperty: ChangeableProperty;
  library: "curves" | "patterns" | "pumps";
  filterByType?: CurveType | PatternType;
  nullLabelKey?: string;
  libraryLabelKey?: string;
};

export type BatchEditPropertyConfig =
  | QuantityConfig
  | CategoryConfig
  | BooleanConfig
  | LibrarySelectConfig;

export type EditableProperties = Record<string, BatchEditPropertyConfig>;

export const BATCH_EDITABLE_PROPERTIES: Partial<
  Record<Asset["type"], Record<string, BatchEditPropertyConfig>>
> = {
  junction: {
    elevation: { fieldType: "quantity", modelProperty: "elevation" },
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
    },
    length: {
      fieldType: "quantity",
      modelProperty: "length",
      positiveOnly: true,
      isNullable: false,
    },
    roughness: {
      fieldType: "quantity",
      modelProperty: "roughness",
      positiveOnly: true,
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      positiveOnly: true,
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
    speed: { fieldType: "quantity", modelProperty: "speed" },
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
    setting: { fieldType: "quantity", modelProperty: "setting" },
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
    },
    minorLoss: {
      fieldType: "quantity",
      modelProperty: "minorLoss",
      positiveOnly: true,
    },
  },
  reservoir: {
    elevation: { fieldType: "quantity", modelProperty: "elevation" },
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
    elevation: { fieldType: "quantity", modelProperty: "elevation" },
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
    },
    diameter: {
      fieldType: "quantity",
      modelProperty: "diameter",
      positiveOnly: true,
      isNullable: false,
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
