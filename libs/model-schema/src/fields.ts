import { type EntityKind, WHOLE_VALUE } from "@epanet-js/change-set";
import { z } from "zod";

import {
  chemicalSourceTypes,
  curveTypes,
  patternTypes,
  pipeStatuses,
  pumpDefinitionTypes,
  pumpStatuses,
  tankMixingModels,
  valveKinds,
  valveStatuses,
} from "./enums";
import { controlsSchema } from "./controls";
import {
  CUSTOM_PROPERTY_PREFIX,
  customAttributeAssetTypes,
  customAttributeSchema,
} from "./custom-attributes";
import { pipeLibrarySchema } from "./pipe-library";
import { rawControlsSchema } from "./raw-controls";
import {
  curvePointsCell,
  flagCell,
  intCell,
  multipliersCell,
  nullableInt,
  nullableNumber,
  numberCell,
  pathCell,
  positionCell,
  textCell,
} from "./cells";

export type FieldSchemas = Record<string, z.ZodTypeAny>;

// `at` orders the data grid and `visibility` drives the map; both ride in the
// field bag and neither has a column.
const unpersisted: FieldSchemas = {
  at: textCell,
  visibility: flagCell,
};

const sharedAsset: FieldSchemas = {
  ...unpersisted,
  label: textCell,
  isActive: flagCell,
};

const sharedNode: FieldSchemas = {
  ...sharedAsset,
  coordinates: positionCell,
  elevation: nullableNumber,
  initialQuality: numberCell,
  chemicalSourceType: z.enum(chemicalSourceTypes),
  chemicalSourceStrength: numberCell,
  chemicalSourcePatternId: intCell,
};

const sharedLink: FieldSchemas = {
  ...sharedAsset,
  coordinates: pathCell,
  connections: z.array(intCell).length(2),
  length: nullableNumber,
};

const junction: FieldSchemas = {
  ...sharedNode,
  emitterCoefficient: numberCell,
};

const reservoir: FieldSchemas = {
  ...sharedNode,
  head: nullableNumber,
  headPatternId: intCell,
};

const tank: FieldSchemas = {
  ...sharedNode,
  initialLevel: nullableNumber,
  minLevel: nullableNumber,
  maxLevel: nullableNumber,
  minVolume: numberCell,
  diameter: nullableNumber,
  overflow: flagCell,
  mixingModel: z.enum(tankMixingModels),
  mixingFraction: numberCell,
  bulkReactionCoeff: numberCell,
  volumeCurveId: intCell,
};

const pipe: FieldSchemas = {
  ...sharedLink,
  initialStatus: z.enum(pipeStatuses),
  diameter: nullableNumber,
  roughness: nullableNumber,
  minorLoss: numberCell,
  bulkReactionCoeff: numberCell,
  wallReactionCoeff: numberCell,
  material: textCell,
  year: numberCell,
};

const pump: FieldSchemas = {
  ...sharedLink,
  initialStatus: z.enum(pumpStatuses),
  definitionType: z.enum(pumpDefinitionTypes),
  power: nullableNumber,
  speed: numberCell,
  speedPatternId: intCell,
  curveId: nullableInt,
  curve: curvePointsCell.nullable(),
  efficiencyCurveId: intCell,
  energyPrice: numberCell,
  energyPricePatternId: intCell,
};

const valve: FieldSchemas = {
  ...sharedLink,
  initialStatus: z.enum(valveStatuses),
  diameter: nullableNumber,
  minorLoss: numberCell,
  kind: z.enum(valveKinds),
  setting: nullableNumber,
  curveId: intCell,
};

const customerPoint: FieldSchemas = {
  label: textCell,
  coordinates: positionCell,
  connection: z
    .object({
      pipeId: intCell,
      junctionId: intCell,
      snapPoint: positionCell,
    })
    .nullable(),
};

const curve: FieldSchemas = {
  label: textCell,
  type: z.enum(curveTypes),
  points: curvePointsCell,
};

const pattern: FieldSchemas = {
  label: textCell,
  type: z.enum(patternTypes),
  multipliers: multipliersCell,
};

// Entities with no fields of their own: the whole value rides in one cell.
const whole = (schema: z.ZodTypeAny): FieldSchemas => ({
  [WHOLE_VALUE]: schema,
});

// A demand list travels as the model holds it. The DB turns it into one row per
// demand, adding the owner column and an ordinal, so the row schema checks a
// shape that does not exist yet at this point.
export const demandsCell = z.array(
  z.object({
    baseDemand: numberCell,
    patternId: nullableInt.optional(),
  }),
);

// The definition is nested `Map`s in the model and a `Map` cannot ride in a
// whole value, so it travels flattened to `<assetType>/<id>` keys. The DB
// regroups it by asset type before parsing, which is why this is not
// `customAttributesDefinitionSchema`.
const customAttributeKeyPattern = new RegExp(
  `^(${customAttributeAssetTypes.join("|")})/.+$`,
);

export const customAttributesPlainCell = z.record(
  z.string().regex(customAttributeKeyPattern),
  customAttributeSchema,
);

export const fieldSchemas: Record<EntityKind, FieldSchemas> = {
  junction,
  reservoir,
  tank,
  pipe,
  pump,
  valve,
  customerPoint,
  curve,
  pattern,
  allControls: whole(controlsSchema),
  junctionDemand: whole(demandsCell),
  customerDemand: whole(demandsCell),
  customAttributesDefinition: whole(customAttributesPlainCell),
  pipeLibrary: whole(pipeLibrarySchema),
  rawControls: whole(rawControlsSchema),
};

// A custom attribute's type comes from the definition rather than from this
// table, so the cell is checked for being a value the format can carry at all.
// `null` is how a removal travels.
export const customAttributeCell = z
  .union([numberCell, textCell, flagCell])
  .nullable();

export const schemaForField = (
  entity: EntityKind,
  field: string,
): z.ZodTypeAny | undefined => {
  if (field.startsWith(CUSTOM_PROPERTY_PREFIX)) return customAttributeCell;
  return fieldSchemas[entity][field];
};
