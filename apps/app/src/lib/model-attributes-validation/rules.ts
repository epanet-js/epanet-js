import { z } from "zod";
import { CustomerPoint } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { EntityType, Rule, Severity, ValidatableEntity } from "./types";

const fromSchema =
  (schema: z.ZodTypeAny) =>
  (value: unknown): boolean =>
    schema.safeParse(value).success;

const range = ({
  min,
  max,
  int = false,
}: {
  min?: number;
  max?: number;
  int?: boolean;
}): ((value: unknown) => boolean) => {
  let schema = int ? z.number().int() : z.number();
  if (min !== undefined) schema = schema.min(min);
  if (max !== undefined) schema = schema.max(max);
  return fromSchema(schema);
};

export const numericChecks = {
  positive: fromSchema(z.number().positive()),
  nonNegative: fromSchema(z.number().nonnegative()),
  unitRange: range({ min: 0, max: 1 }),
  year: range({ min: 1000, max: 9999, int: true }),
} satisfies Record<string, (value: number) => boolean>;

type NumericCheckName = keyof typeof numericChecks;

const isNumber = fromSchema(z.number());

const field =
  (name: string) =>
  (entity: ValidatableEntity): unknown =>
    (entity as unknown as Record<string, unknown>)[name];

const prop = (entity: ValidatableEntity, name: string): unknown =>
  (entity as unknown as Record<string, unknown>)[name];

const checkMessage: Record<NumericCheckName, string> = {
  positive: "mustBePositive",
  nonNegative: "mustBeNonNegative",
  unitRange: "mustBeWithinUnitRange",
  year: "invalidYear",
};

type When = (entity: ValidatableEntity, model: HydraulicModel) => boolean;

const presence = (
  entityType: EntityType,
  fieldName: string,
  appliesWhen?: When,
): Rule => ({
  id: `${entityType}.${fieldName}.present`,
  entityType,
  field: fieldName,
  accessor: field(fieldName),
  appliesWhen,
  check: isNumber,
  severity: "error",
  message: "required",
});

const valueRule = (
  entityType: EntityType,
  fieldName: string,
  checkName: NumericCheckName,
  severity: Severity,
  appliesWhen?: When,
  { optional = false }: { optional?: boolean } = {},
): Rule => {
  const predicate = numericChecks[checkName];
  return {
    id: `${entityType}.${fieldName}.${checkName}`,
    entityType,
    field: fieldName,
    accessor: field(fieldName),
    appliesWhen,
    check: (value) => (optional && value == null) || predicate(value),
    severity,
    message: checkMessage[checkName],
  };
};

const requiredNumeric = (
  entityType: EntityType,
  fieldName: string,
  sign?: "positive" | "nonNegative",
  appliesWhen?: When,
): Rule[] => {
  const rules = [presence(entityType, fieldName, appliesWhen)];
  if (sign)
    rules.push(valueRule(entityType, fieldName, sign, "error", appliesWhen));
  return rules;
};

const optionalNumeric = (
  entityType: EntityType,
  fieldName: string,
  checkName: "nonNegative" | "unitRange",
  severity: Severity,
  appliesWhen?: When,
): Rule =>
  valueRule(entityType, fieldName, checkName, severity, appliesWhen, {
    optional: true,
  });

export const RULES: Rule[] = [
  // Pipes
  ...requiredNumeric("pipe", "diameter", "positive"),
  ...requiredNumeric("pipe", "roughness", "positive"),
  ...requiredNumeric("pipe", "length", "positive"),
  // Year and material are optional informational attributes (used for roughness
  // inference), so empty is allowed; only an out-of-range/non-integer year warns.
  {
    id: "pipe.year.valid",
    entityType: "pipe",
    field: "year",
    accessor: field("year"),
    check: (value) => value == undefined || numericChecks.year(value),
    severity: "warning",
    message: "invalidYear",
  },
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
  // Tank levels only apply in diameter (cylindrical) mode; curve-based tanks
  // derive them from the volume curve.
  ...requiredNumeric(
    "tank",
    "maxLevel",
    "positive",
    (entity) => prop(entity, "volumeCurveId") == null,
  ),
  ...requiredNumeric(
    "tank",
    "minLevel",
    "nonNegative",
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
  // Power only applies to constant-power pumps; curve-defined pumps ignore it.
  ...requiredNumeric(
    "pump",
    "power",
    "positive",
    (entity) => prop(entity, "definitionType") === "power",
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
    check: (value) => (value as CustomerPoint).connection !== null,
    severity: "warning",
    message: "disconnected",
  },
];
