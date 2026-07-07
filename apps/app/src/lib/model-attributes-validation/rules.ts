import { CurvePoint, getPumpCurveErrors } from "@epanet-js/hydraulic-model";
import { HydraulicModel } from "src/hydraulic-model";
import { EntityType, Rule, Severity, ValidatableEntity } from "./types";
import {
  NumericCheckName,
  checkMessage,
  isFiniteNumber,
  isNumber,
  numericChecks,
} from "./checks";

const field =
  (name: string) =>
  (entity: ValidatableEntity): unknown =>
    (entity as unknown as Record<string, unknown>)[name];

const readEntityProp = (entity: ValidatableEntity, name: string): unknown =>
  (entity as unknown as Record<string, unknown>)[name];

type When = (entity: ValidatableEntity, model?: HydraulicModel) => boolean;

const presence = (
  entityType: EntityType,
  fieldName: string,
  appliesWhen?: When,
): Rule => ({
  id: `${entityType}.${fieldName}.present`,
  type: "field",
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
    type: "field",
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

const tankVolumeCurveless: When = (entity) =>
  readEntityProp(entity, "volumeCurveId") == null;

const pumpCurveBased: When = (entity) => {
  const definitionType = readEntityProp(entity, "definitionType");
  return (
    definitionType === "designPointCurve" || definitionType === "standardCurve"
  );
};

const tankLevelsOrdered = (
  initialLevel: unknown,
  entity?: ValidatableEntity,
): boolean => {
  if (!entity) return true;
  const min = readEntityProp(entity, "minLevel");
  const max = readEntityProp(entity, "maxLevel");
  if (![initialLevel, min, max].every(isFiniteNumber)) return true;
  // Negative bounds are already reported by their own sign rules.
  if ((min as number) < 0 || (max as number) < 0) return true;
  return (
    (min as number) <= (initialLevel as number) &&
    (initialLevel as number) <= (max as number)
  );
};

const tankHasStorageRange = (
  maxLevel: unknown,
  entity?: ValidatableEntity,
): boolean => {
  if (!entity) return true;
  const min = readEntityProp(entity, "minLevel");
  if (![maxLevel, min].every(isFiniteNumber)) return true;
  return (maxLevel as number) > (min as number);
};

export const RULES: Rule[] = [
  // Pipes
  ...requiredNumeric("pipe", "diameter", "positive"),
  ...requiredNumeric("pipe", "roughness", "positive"),
  ...requiredNumeric("pipe", "length", "positive"),
  {
    id: "pipe.year.valid",
    type: "field",
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
  {
    id: "tank.initialLevel.withinLevelRange",
    type: "entity",
    entityType: "tank",
    field: "initialLevel",
    accessor: field("initialLevel"),
    appliesWhen: tankVolumeCurveless,
    check: tankLevelsOrdered,
    severity: "error",
    message: "mustBeWithinLevelRange",
  },
  ...requiredNumeric("tank", "diameter", "positive", tankVolumeCurveless),
  ...requiredNumeric("tank", "maxLevel", "positive", tankVolumeCurveless),
  {
    id: "tank.maxLevel.aboveMinLevel",
    type: "entity",
    entityType: "tank",
    field: "maxLevel",
    accessor: field("maxLevel"),
    appliesWhen: tankVolumeCurveless,
    check: tankHasStorageRange,
    severity: "warning",
    message: "mustBeAboveMinLevel",
  },
  ...requiredNumeric("tank", "minLevel", "nonNegative", tankVolumeCurveless),
  // Valves
  ...requiredNumeric("valve", "diameter", "positive"),
  ...requiredNumeric(
    "valve",
    "setting",
    undefined,
    (entity) => readEntityProp(entity, "kind") !== "gpv",
  ),
  ...requiredNumeric(
    "pump",
    "power",
    "positive",
    (entity) => readEntityProp(entity, "definitionType") === "power",
  ),
  {
    id: "pump.curve.present",
    type: "field",
    entityType: "pump",
    field: "curve",
    accessor: field("curve"),
    appliesWhen: pumpCurveBased,
    check: (value) => Array.isArray(value) && value.length > 0,
    severity: "error",
    message: "required",
  },
  {
    id: "pump.curve.valid",
    type: "field",
    entityType: "pump",
    field: "curve",
    accessor: field("curve"),
    appliesWhen: pumpCurveBased,
    check: (value) =>
      !Array.isArray(value) ||
      value.length === 0 ||
      getPumpCurveErrors(value as CurvePoint[]).length === 0,
    severity: "error",
    message: "invalidCurve",
  },
  {
    id: "pump.curveId.present",
    type: "field",
    entityType: "pump",
    field: "curveId",
    accessor: field("curveId"),
    appliesWhen: (entity) =>
      readEntityProp(entity, "definitionType") === "curveId",
    check: isFiniteNumber,
    severity: "error",
    message: "required",
  },
  {
    id: "pump.curveId.valid",
    type: "model",
    entityType: "pump",
    field: "curveId",
    accessor: field("curveId"),
    appliesWhen: (entity) =>
      readEntityProp(entity, "definitionType") === "curveId",
    check: (value, _entity, model) => {
      if (!model || !isFiniteNumber(value)) return true;
      const points = model.curves.get(value)?.points;
      if (points === undefined) return false;
      return points.length === 0 || getPumpCurveErrors(points).length === 0;
    },
    severity: "error",
    message: "invalidCurve",
  },
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
    (entity) => readEntityProp(entity, "mixingModel") === "2comp",
  ),
  optionalNumeric("pump", "energyPrice", "nonNegative", "error"),
  ...(["junction", "reservoir", "tank"] as const).map(
    (entityType): Rule => ({
      ...optionalNumeric(
        entityType,
        "chemicalSourceStrength",
        "nonNegative",
        "warning",
        (entity) => readEntityProp(entity, "chemicalSourceType") != null,
      ),
      id: "node.chemicalSourceStrength.nonNegative",
    }),
  ),
  // Customer points
  {
    id: "customerPoint.connected",
    type: "field",
    entityType: "customerPoint",
    accessor: field("connection"),
    check: (value) => value !== null,
    severity: "warning",
    message: "disconnected",
  },
];
