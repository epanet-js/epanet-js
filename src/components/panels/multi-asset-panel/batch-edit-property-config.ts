import { Asset } from "src/hydraulic-model";
import { pipeStatuses } from "src/hydraulic-model/asset-types/pipe";
import { pumpStatuses } from "src/hydraulic-model/asset-types/pump";
import {
  valveStatuses,
  valveKinds,
} from "src/hydraulic-model/asset-types/valve";

type QuantityConfig = {
  fieldType: "quantity";
  modelProperty: string;
  positiveOnly?: boolean;
  isNullable?: boolean;
};

type CategoryConfig = {
  fieldType: "category";
  modelProperty: string;
  statsPrefix: string;
  values: readonly string[];
  useUppercaseLabel?: boolean;
};

type BooleanConfig = {
  fieldType: "boolean";
  modelProperty: string;
};

export type BatchEditPropertyConfig =
  | QuantityConfig
  | CategoryConfig
  | BooleanConfig;

export const BATCH_EDITABLE_PROPERTIES: Partial<
  Record<Asset["type"], Record<string, BatchEditPropertyConfig>>
> = {
  junction: {
    isEnabled: { fieldType: "boolean", modelProperty: "isActive" },
    elevation: { fieldType: "quantity", modelProperty: "elevation" },
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
  },
  pump: {
    isEnabled: { fieldType: "boolean", modelProperty: "isActive" },
    initialStatus: {
      fieldType: "category",
      modelProperty: "initialStatus",
      statsPrefix: "pump.",
      values: pumpStatuses,
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
    isEnabled: { fieldType: "boolean", modelProperty: "isActive" },
    elevation: { fieldType: "quantity", modelProperty: "elevation" },
    head: { fieldType: "quantity", modelProperty: "head" },
  },
  tank: {
    isEnabled: { fieldType: "boolean", modelProperty: "isActive" },
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
  },
};
