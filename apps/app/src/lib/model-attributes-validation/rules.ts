import { z } from "zod";
import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { EntityType, Rule, ValidatableEntity } from "./types";

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

// First batch of nullable attributes. Deferred (map/HGL/arrow/control coupled):
// pipe.diameter, pipe.length, *.elevation, tank.minLevel, tank.maxLevel.
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
