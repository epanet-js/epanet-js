import {
  Asset,
  CurvePoint,
  effectiveRoughness,
  FlowModulatingValveControl,
  getLinkFlowModulatingValve,
  getLinkVariableSpeedPump,
  VariableSpeedPumpControl,
  getPumpCurveErrors,
  inferredRoughness,
  Pipe,
  HydraulicModel,
} from "@epanet-js/hydraulic-model";
import { EntityType, Rule, Severity, ValidatableEntity } from "./types";
import {
  NumericCheckName,
  checkMessage,
  isFiniteNumber,
  isNumber,
  numericChecks,
} from "./checks";
import {
  FLOW_MODULATING_VALVE_MIN_POINTS,
  flowModulatingValvePointChecks,
} from "./flow-modulating-valve-points";

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

const effectiveRoughnessOf = (
  entity: ValidatableEntity,
  model?: HydraulicModel,
): unknown => effectiveRoughness(entity as Pipe, model?.pipeMaterials ?? []);

const needsInferredRoughness: When = (entity, model) =>
  readEntityProp(entity, "roughness") == null &&
  readEntityProp(entity, "material") != null &&
  !!model &&
  model.pipeMaterials.length > 0;

const isMaterialInLibrary = (
  entity: ValidatableEntity,
  model?: HydraulicModel,
): boolean => {
  const label = String(readEntityProp(entity, "material")).toLowerCase();
  return (
    !!model &&
    model.pipeMaterials.some(
      (material) => material.label.toLowerCase() === label,
    )
  );
};

const materialInLibrary: Rule = {
  id: "pipe.material.inLibrary",
  type: "model",
  entityType: "pipe",
  field: "material",
  accessor: field("material"),
  appliesWhen: needsInferredRoughness,
  check: (_value, entity, model) =>
    !entity || isMaterialInLibrary(entity, model),
  severity: "warning",
  message: "notInLibrary",
};

const materialProvidesRoughness: Rule = {
  id: "pipe.material.providesRoughness",
  type: "model",
  entityType: "pipe",
  field: "material",
  accessor: field("material"),
  appliesWhen: (entity, model) =>
    needsInferredRoughness(entity, model) && isMaterialInLibrary(entity, model),
  check: (_value, entity, model) =>
    !entity ||
    inferredRoughness(entity as Pipe, model?.pipeMaterials ?? []) != null,
  severity: "warning",
  message: "noRoughnessForPipe",
};

const flowModulatingControlOf = (
  entity: ValidatableEntity,
  model?: HydraulicModel,
): FlowModulatingValveControl | null =>
  model
    ? getLinkFlowModulatingValve(
        model.controls,
        readEntityProp(entity, "id") as number,
      )
    : null;

const hasFlowModulatingControl: When = (entity, model) =>
  flowModulatingControlOf(entity, model) !== null;

const flowModulatingControlHasEnoughPoints = (value: unknown): boolean =>
  !value ||
  (value as FlowModulatingValveControl).points.length >=
    FLOW_MODULATING_VALVE_MIN_POINTS;

const flowModulatingControlRule = (
  checkName: keyof typeof flowModulatingValvePointChecks,
  message: string,
): Rule => ({
  id: `valve.flowModulatingControl.${checkName}`,
  type: "model",
  entityType: "valve",
  field: "flowModulatingControl",
  accessor: flowModulatingControlOf,
  appliesWhen: hasFlowModulatingControl,
  check: (value) =>
    !value ||
    flowModulatingValvePointChecks[checkName](
      (value as FlowModulatingValveControl).points,
    ),
  severity: "error",
  message,
});

const flowModulatingReferenceRule = (
  name: "sensorLink" | "controlNode",
  referenceId: "sensorLinkId" | "controlNodeId",
): Rule => {
  const fieldName = `flowModulating${name.charAt(0).toUpperCase()}${name.slice(1)}`;
  return {
    id: `valve.${fieldName}.active`,
    type: "model",
    entityType: "valve",
    field: fieldName,
    accessor: (entity, model) => {
      const control = flowModulatingControlOf(entity, model);
      return control ? (model.assets.get(control[referenceId]) ?? null) : null;
    },
    appliesWhen: hasFlowModulatingControl,
    check: (value) => !!value && (value as Asset).isActive,
    severity: "error",
    message: "mustBeActive",
  };
};

const variableSpeedControlOf = (
  entity: ValidatableEntity,
  model?: HydraulicModel,
): VariableSpeedPumpControl | null =>
  model
    ? getLinkVariableSpeedPump(
        model.controls,
        readEntityProp(entity, "id") as number,
      )
    : null;

const isActiveAsset = (
  model: HydraulicModel | undefined,
  assetId: number,
): boolean => {
  const asset = model?.assets.get(assetId);
  return !!asset && asset.isActive;
};

const variableSpeedTargetRule = (
  quantity: VariableSpeedPumpControl["quantity"],
  name: "Pressure" | "Flow" | "Level",
): Rule => ({
  id: `pump.variableSpeed${name}Target.active`,
  type: "model",
  entityType: "pump",
  field: `variableSpeed${name}Target`,
  accessor: variableSpeedControlOf,
  appliesWhen: (entity, model) =>
    variableSpeedControlOf(entity, model)?.quantity === quantity,
  check: (value, _entity, model) =>
    !value ||
    isActiveAsset(model, (value as VariableSpeedPumpControl).targetId),
  severity: "error",
  message: "mustBeActive",
});

export const RULES: Rule[] = [
  // Node elevation (reservoirs use head, not elevation, so are excluded)
  ...(["junction", "tank"] as const).map(
    (entityType): Rule => ({
      ...presence(entityType, "elevation"),
      id: "node.elevation.present",
    }),
  ),
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
  {
    id: "valve.flowModulatingControl.enoughPoints",
    type: "field",
    entityType: "valve",
    field: "flowModulatingControl",
    accessor: flowModulatingControlOf,
    appliesWhen: hasFlowModulatingControl,
    check: flowModulatingControlHasEnoughPoints,
    severity: "error",
    message: "notEnoughPoints",
  },
  flowModulatingControlRule("flowsNonNegative", "mustBeNonNegative"),
  flowModulatingControlRule("pressuresPositive", "mustBePositive"),
  flowModulatingControlRule("flowsIncreasing", "mustBeIncreasing"),
  flowModulatingControlRule("pressuresIncreasing", "mustBeIncreasing"),
  flowModulatingReferenceRule("sensorLink", "sensorLinkId"),
  flowModulatingReferenceRule("controlNode", "controlNodeId"),
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
  // Pipes
  ...requiredNumeric("pipe", "diameter", "positive"),
  ...requiredNumeric("pipe", "length", "positive"),
  ...requiredNumeric("pipe", "roughness", "positive").map(
    (rule): Rule => ({ ...rule, accessor: effectiveRoughnessOf }),
  ),
  materialInLibrary,
  materialProvidesRoughness,
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
  variableSpeedTargetRule("pressure", "Pressure"),
  variableSpeedTargetRule("flow", "Flow"),
  variableSpeedTargetRule("level", "Level"),
  {
    id: "pump.variableSpeedLaggedPumps.active",
    type: "model",
    entityType: "pump",
    field: "variableSpeedLaggedPumps",
    accessor: variableSpeedControlOf,
    appliesWhen: (entity, model) =>
      (variableSpeedControlOf(entity, model)?.laggedPumpIds.length ?? 0) > 0,
    check: (value, _entity, model) =>
      !value ||
      (value as VariableSpeedPumpControl).laggedPumpIds.every((id) =>
        isActiveAsset(model, id),
      ),
    severity: "error",
    message: "mustBeActive",
  },
  {
    id: "pump.variableSpeedTankLevels.active",
    type: "model",
    entityType: "pump",
    field: "variableSpeedTankLevels",
    accessor: variableSpeedControlOf,
    appliesWhen: (entity, model) =>
      variableSpeedControlOf(entity, model)?.tankLevels != null,
    check: (value, _entity, model) => {
      const tankLevels = (value as VariableSpeedPumpControl | null)?.tankLevels;
      return !tankLevels || isActiveAsset(model, tankLevels.tankId);
    },
    severity: "error",
    message: "mustBeActive",
  },
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
