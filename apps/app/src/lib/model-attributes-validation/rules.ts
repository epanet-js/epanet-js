import { z } from "zod";
import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { EntityType, Rule, Severity, ValidatableEntity } from "./types";

const fromSchema =
  (schema: z.ZodTypeAny) =>
  (value: unknown): boolean =>
    schema.safeParse(value).success;

const field =
  (name: string) =>
  (entity: ValidatableEntity): unknown =>
    (entity as unknown as Record<string, unknown>)[name];

const prop = (entity: ValidatableEntity, name: string): unknown =>
  (entity as unknown as Record<string, unknown>)[name];

type NumericCheck = "present" | "positive" | "nonNegative";

const checkSchema: Record<NumericCheck, z.ZodTypeAny> = {
  present: z.number(),
  positive: z.number().positive(),
  nonNegative: z.number().nonnegative(),
};

const checkMessage: Record<NumericCheck, string> = {
  present: "required",
  positive: "mustBePositive",
  nonNegative: "mustBeNonNegative",
};

type When = (entity: ValidatableEntity, model: HydraulicModel) => boolean;

const numericRule = (
  entityType: EntityType,
  fieldName: string,
  check: NumericCheck,
  when?: When,
): Rule => ({
  id: `${entityType}.${fieldName}.${check}`,
  entityType,
  field: fieldName,
  accessor: field(fieldName),
  validate: (value, entity, model) =>
    (when ? !when(entity, model) : false) ||
    fromSchema(checkSchema[check])(value),
  severity: "error",
  message: checkMessage[check],
});

// Emits the presence rule followed by the optional sign rule, in that order so
// the field group's fail-fast reports "required" before "mustBePositive".
const requiredNumeric = (
  entityType: EntityType,
  fieldName: string,
  sign?: "positive" | "nonNegative",
  when?: When,
): Rule[] => {
  const rules = [numericRule(entityType, fieldName, "present", when)];
  if (sign) rules.push(numericRule(entityType, fieldName, sign, when));
  return rules;
};

type OptionalCheck = "nonNegative" | "unitRange";

const optionalCheckSchema: Record<OptionalCheck, z.ZodTypeAny> = {
  nonNegative: z.number().nonnegative(),
  unitRange: z.number().min(0).max(1),
};

const optionalCheckMessage: Record<OptionalCheck, string> = {
  nonNegative: "mustBeNonNegative",
  unitRange: "mustBeWithinUnitRange",
};

const optionalNumeric = (
  entityType: EntityType,
  fieldName: string,
  check: OptionalCheck,
  severity: Severity,
  when?: When,
): Rule => ({
  id: `${entityType}.${fieldName}.${check}`,
  entityType,
  field: fieldName,
  accessor: field(fieldName),
  validate: (value, entity, model) => {
    if (when && !when(entity, model)) return true;
    if (value == null) return true; // empty is allowed for optional attributes
    return fromSchema(optionalCheckSchema[check])(value);
  },
  severity,
  message: optionalCheckMessage[check],
});

export const RULES: Rule[] = [
  // Pipes
  ...requiredNumeric("pipe", "roughness", "positive"),
  // Reservoirs
  ...requiredNumeric("reservoir", "head"),
  // Tanks
  ...requiredNumeric("tank", "initialLevel", "nonNegative"),
  ...requiredNumeric(
    "tank",
    "diameter",
    "positive",
    (entity) => prop(entity, "volumeCurveId") == null,
  ),
  // Valves
  ...requiredNumeric("valve", "diameter", "positive"),
  // All valve kinds need a numeric setting except gpv, which uses a curve.
  ...requiredNumeric(
    "valve",
    "setting",
    undefined,
    (entity) => prop(entity, "kind") !== "gpv",
  ),
  optionalNumeric("pipe", "minorLoss", "nonNegative", "error"),
  optionalNumeric("valve", "minorLoss", "nonNegative", "error"),
  optionalNumeric("tank", "minVolume", "nonNegative", "error"),
  optionalNumeric("pump", "speed", "nonNegative", "error"),
  optionalNumeric("junction", "emitterCoefficient", "nonNegative", "warning"),
  ...(["junction", "reservoir", "tank"] as const).map(
    (entityType): Rule => ({
      ...optionalNumeric(
        entityType,
        "initialQuality",
        "nonNegative",
        "warning",
      ),
      id: "node.initialQuality.nonNegative",
    }),
  ),
  optionalNumeric(
    "tank",
    "mixingFraction",
    "unitRange",
    "warning",
    (entity) => prop(entity, "mixingModel") === "2comp",
  ),
  optionalNumeric("pump", "energyPrice", "nonNegative", "error"),
  ...(["junction", "reservoir", "tank"] as const).map(
    (entityType): Rule => ({
      ...optionalNumeric(
        entityType,
        "chemicalSourceStrength",
        "nonNegative",
        "warning",
        (entity) => prop(entity, "chemicalSourceType") != null,
      ),
      id: "node.chemicalSourceStrength.nonNegative",
    }),
  ),
  // Customer points
  {
    id: "customerPoint.connected",
    entityType: "customerPoint",
    accessor: (entity) => entity,
    validate: (_value, entity) => (entity as CustomerPoint).connection !== null,
    severity: "warning",
    message: "disconnected",
  },
];
