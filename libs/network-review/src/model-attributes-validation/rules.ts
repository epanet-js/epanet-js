import {
  AssetId,
  CurvePoint,
  effectiveRoughness,
  FlowModulatingValveControl,
  getLinkFlowModulatingValve,
  getLinkLevelOpening,
  getLinkLevelSetting,
  getLinkTimedSetting,
  getLinkVariableSpeedPump,
  LevelOpeningControl,
  LevelSettingControl,
  LevelSettingError,
  TimedSettingControl,
  validateLevelSetting,
  validateTimeSequence,
  VariableSpeedPumpControl,
  getCurveErrors,
  getPumpCurveErrors,
  inferredRoughness,
  Pipe,
  Pump,
  HydraulicModel,
  remoteFlowDirectionOf,
  NumericCheckName,
  numericChecks,
  FLOW_MODULATING_VALVE_MIN_POINTS,
  flowModulatingValvePointChecks,
  valveCurveTypeFrom,
  ValveKind,
} from "@epanet-js/hydraulic-model";
import { EntityType, Rule, Severity, ValidatableEntity } from "./types";
import { checkMessage, isFiniteNumber, isNumber } from "./checks";
import { pumpBackfeedsItself } from "./pump-backfeed";

const field =
  (name: string) =>
  (entity: ValidatableEntity): unknown =>
    (entity as unknown as Record<string, unknown>)[name];

const readEntityProp = (entity: ValidatableEntity, name: string): unknown =>
  (entity as unknown as Record<string, unknown>)[name];

type When = (entity: ValidatableEntity, model?: HydraulicModel) => boolean;

const isActiveEntity: When = (entity) =>
  readEntityProp(entity, "isActive") === true;

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
        readEntityProp(entity, "id") as AssetId,
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
    accessor: (entity, model) =>
      flowModulatingControlOf(entity, model)?.[referenceId] ?? null,
    appliesWhen: (entity, model) =>
      isActiveEntity(entity) && hasFlowModulatingControl(entity, model),
    check: (value, _entity, model) => isActiveAsset(model, value as AssetId),
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
        readEntityProp(entity, "id") as AssetId,
      )
    : null;

const levelSettingControlOf = (
  entity: ValidatableEntity,
  model?: HydraulicModel,
): LevelSettingControl | null =>
  model
    ? getLinkLevelSetting(
        model.controls,
        readEntityProp(entity, "id") as AssetId,
      )
    : null;

const hasLevelSettingControl: When = (entity, model) =>
  isActiveEntity(entity) && levelSettingControlOf(entity, model) !== null;

const tankLevelErrorsOf = (
  tankId: AssetId,
  onLevel: number,
  offLevel: number,
  model?: HydraulicModel,
) => {
  const tank = model?.assets.get(tankId);
  const minLevel = tank ? readEntityProp(tank, "minLevel") : null;
  const maxLevel = tank ? readEntityProp(tank, "maxLevel") : null;
  return validateLevelSetting({
    onLevel,
    offLevel,
    minLevel: isFiniteNumber(minLevel) ? minLevel : -Infinity,
    maxLevel: isFiniteNumber(maxLevel) ? maxLevel : Infinity,
  });
};

const levelSettingErrorsOf = (
  control: LevelSettingControl,
  model?: HydraulicModel,
) =>
  tankLevelErrorsOf(control.tankId, control.on.level, control.off.level, model);

const isOutOfRange = (error: LevelSettingError) =>
  error === "onOutOfRange" || error === "offOutOfRange";

const levelSettingRule = (
  checkName: string,
  severity: Severity,
  message: string,
  isValid: (control: LevelSettingControl, model?: HydraulicModel) => boolean,
): Rule => ({
  id: `pump.levelSettingControl.${checkName}`,
  type: "model",
  entityType: "pump",
  field: "levelSettingControl",
  accessor: levelSettingControlOf,
  appliesWhen: hasLevelSettingControl,
  check: (value, _entity, model) =>
    value === null || isValid(value as LevelSettingControl, model),
  severity,
  message,
});

const isActiveAsset = (
  model: HydraulicModel | undefined,
  assetId: AssetId,
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
  accessor: (entity, model) =>
    variableSpeedControlOf(entity, model)?.targetId ?? null,
  appliesWhen: (entity, model) =>
    isActiveEntity(entity) &&
    variableSpeedControlOf(entity, model)?.quantity === quantity,
  check: (value, _entity, model) =>
    value === null || isActiveAsset(model, value as AssetId),
  severity: "error",
  message: "mustBeActive",
});

const variableSpeedDischargeNotBackfeeding: Rule = {
  id: "pump.variableSpeedDischarge.notBackfeeding",
  type: "model",
  entityType: "pump",
  accessor: (entity) => entity,
  appliesWhen: (entity, model) =>
    isActiveEntity(entity) && variableSpeedControlOf(entity, model) !== null,
  check: (_value, entity, model) =>
    !entity || !model || !pumpBackfeedsItself(entity as Pump, model),
  severity: "warning",
  message: "backfeedsItself",
};

const variableSpeedFlowTargetSameDirection: Rule = {
  id: "pump.variableSpeedFlowTarget.sameDirection",
  type: "model",
  entityType: "pump",
  accessor: (entity, model) =>
    variableSpeedControlOf(entity, model)?.targetId ?? null,
  appliesWhen: (entity, model) =>
    isActiveEntity(entity) &&
    variableSpeedControlOf(entity, model)?.quantity === "flow",
  check: (value, entity, model) => {
    if (!entity || !model || value === null) return true;
    const target = model.assets.get(value as AssetId);
    if (!target || !target.isActive || !target.isLink) return true;
    const pumpId = readEntityProp(entity, "id") as AssetId;
    return remoteFlowDirectionOf(model, pumpId, target.id) === 1;
  },
  severity: "warning",
  message: "mustFollowPumpDirection",
};

const levelSettingControlRules: Rule[] = [
  levelSettingRule(
    "onBelowOff",
    "error",
    "mustBeBelowOffLevel",
    (control, model) => !levelSettingErrorsOf(control, model).includes("order"),
  ),
  levelSettingRule(
    "onSpeedNonNegative",
    "error",
    "mustBeNonNegative",
    (control) => numericChecks.nonNegative(control.on.setting),
  ),
  levelSettingRule(
    "withinTankLevels",
    "warning",
    "mustBeWithinLevelRange",
    (control, model) =>
      !levelSettingErrorsOf(control, model).some(isOutOfRange),
  ),
];

const levelOpeningControlOf = (
  entity: ValidatableEntity,
  model?: HydraulicModel,
): LevelOpeningControl | null =>
  model
    ? getLinkLevelOpening(
        model.controls,
        readEntityProp(entity, "id") as AssetId,
      )
    : null;

const hasLevelOpeningControl: When = (entity, model) =>
  isActiveEntity(entity) &&
  readEntityProp(entity, "kind") === "pcv" &&
  levelOpeningControlOf(entity, model) !== null;

const levelOpeningErrorsOf = (
  control: LevelOpeningControl,
  model?: HydraulicModel,
) =>
  tankLevelErrorsOf(
    control.tankId,
    control.level.open,
    control.level.close,
    model,
  );

const levelOpeningRule = (
  checkName: string,
  severity: Severity,
  message: string,
  isValid: (control: LevelOpeningControl, model?: HydraulicModel) => boolean,
): Rule => ({
  id: `valve.levelOpeningControl.${checkName}`,
  type: "model",
  entityType: "valve",
  field: "levelOpeningControl",
  accessor: levelOpeningControlOf,
  appliesWhen: hasLevelOpeningControl,
  check: (value, _entity, model) =>
    value === null || isValid(value as LevelOpeningControl, model),
  severity,
  message,
});

const levelOpeningControlRules: Rule[] = [
  levelOpeningRule(
    "openBelowClose",
    "error",
    "mustBeBelowCloseLevel",
    (control, model) => !levelOpeningErrorsOf(control, model).includes("order"),
  ),
  levelOpeningRule(
    "withinTankLevels",
    "warning",
    "mustBeWithinLevelRange",
    (control, model) =>
      !levelOpeningErrorsOf(control, model).some(isOutOfRange),
  ),
  {
    id: "valve.levelOpeningTank.active",
    type: "model",
    entityType: "valve",
    field: "levelOpeningTank",
    accessor: (entity, model) =>
      levelOpeningControlOf(entity, model)?.tankId ?? null,
    appliesWhen: hasLevelOpeningControl,
    check: (value, _entity, model) =>
      value === null || isActiveAsset(model, value as AssetId),
    severity: "error",
    message: "mustBeActive",
  },
];

const hasVariableSpeedControl: When = (entity, model) =>
  isActiveEntity(entity) && variableSpeedControlOf(entity, model) !== null;

const variableSpeedSpeedRule = (
  speed: "minSpeed" | "maxSpeed",
  checkName: NumericCheckName,
): Rule => {
  const fieldName =
    speed === "minSpeed" ? "variableSpeedMinSpeed" : "variableSpeedMaxSpeed";
  return {
    id: `pump.${fieldName}.${checkName}`,
    type: "model",
    entityType: "pump",
    field: fieldName,
    accessor: (entity, model) =>
      variableSpeedControlOf(entity, model)?.[speed] ?? null,
    appliesWhen: hasVariableSpeedControl,
    check: (value) => value === null || numericChecks[checkName](value),
    severity: "error",
    message: checkMessage[checkName],
  };
};

const variableSpeedTankLevelsErrorsOf = (
  entity: ValidatableEntity,
  model?: HydraulicModel,
): LevelSettingError[] => {
  const tankLevels = variableSpeedControlOf(entity, model)?.tankLevels;
  return tankLevels
    ? tankLevelErrorsOf(
        tankLevels.tankId,
        tankLevels.onLevel,
        tankLevels.offLevel,
        model,
      )
    : [];
};

const variableSpeedTankLevelSettingRule = (
  checkName: string,
  severity: Severity,
  message: string,
  isValid: (errors: LevelSettingError[]) => boolean,
): Rule => ({
  id: `pump.variableSpeedTankLevelSetting.${checkName}`,
  type: "model",
  entityType: "pump",
  field: "variableSpeedTankLevelSetting",
  accessor: variableSpeedTankLevelsErrorsOf,
  appliesWhen: (entity, model) =>
    isActiveEntity(entity) &&
    variableSpeedControlOf(entity, model)?.tankLevels != null,
  check: (value) => isValid(value as LevelSettingError[]),
  severity,
  message,
});

const variableSpeedPressureTargetValuePositive: Rule = {
  id: "pump.variableSpeedPressureTargetValue.positive",
  type: "model",
  entityType: "pump",
  field: "variableSpeedPressureTargetValue",
  accessor: (entity, model) =>
    variableSpeedControlOf(entity, model)?.target ?? null,
  appliesWhen: (entity, model) => {
    const control = variableSpeedControlOf(entity, model);
    return (
      isActiveEntity(entity) &&
      control?.quantity === "pressure" &&
      control.schedule.length === 0
    );
  },
  check: (value) => value === null || numericChecks.positive(value),
  severity: "error",
  message: checkMessage.positive,
};

const timedSettingControlOf = (
  entity: ValidatableEntity,
  model?: HydraulicModel,
): TimedSettingControl | null =>
  model
    ? getLinkTimedSetting(
        model.controls,
        readEntityProp(entity, "id") as AssetId,
      )
    : null;

const timedSettingStepsRule = (
  checkName: string,
  severity: Severity,
  message: string,
  isValid: (control: TimedSettingControl) => boolean,
): Rule => ({
  id: `pump.timedSettingSteps.${checkName}`,
  type: "model",
  entityType: "pump",
  field: "timedSettingSteps",
  accessor: timedSettingControlOf,
  appliesWhen: (entity, model) =>
    isActiveEntity(entity) && timedSettingControlOf(entity, model) !== null,
  check: (value) => value === null || isValid(value as TimedSettingControl),
  severity,
  message,
});

const timesOf = (entries: readonly { time: number }[]) =>
  entries.map(({ time }) => time);

const timedSettingControlRules: Rule[] = [
  timedSettingStepsRule(
    "timesInSequence",
    "error",
    "mustBeInTimeOrder",
    (control) =>
      !validateTimeSequence(timesOf(control.steps)).includes("outOfOrder"),
  ),
  timedSettingStepsRule(
    "speedsNonNegative",
    "error",
    "mustBeNonNegative",
    (control) =>
      control.steps.every((step) => numericChecks.nonNegative(step.setting)),
  ),
  timedSettingStepsRule(
    "timesDistinct",
    "warning",
    "mustNotRepeatTimes",
    (control) =>
      !validateTimeSequence(timesOf(control.steps)).includes("repeated"),
  ),
];

const variableSpeedScheduleRule = (
  checkName: string,
  severity: Severity,
  message: string,
  isValid: (control: VariableSpeedPumpControl) => boolean,
  appliesTo: (control: VariableSpeedPumpControl) => boolean = () => true,
): Rule => ({
  id: `pump.variableSpeedSchedule.${checkName}`,
  type: "model",
  entityType: "pump",
  field: "variableSpeedSchedule",
  accessor: variableSpeedControlOf,
  appliesWhen: (entity, model) => {
    const control = variableSpeedControlOf(entity, model);
    return (
      isActiveEntity(entity) &&
      control !== null &&
      control.schedule.length > 0 &&
      appliesTo(control)
    );
  },
  check: (value) =>
    value === null || isValid(value as VariableSpeedPumpControl),
  severity,
  message,
});

const variableSpeedScheduleRules: Rule[] = [
  variableSpeedScheduleRule(
    "timesInSequence",
    "error",
    "mustBeInTimeOrder",
    (control) =>
      !validateTimeSequence(timesOf(control.schedule)).includes("outOfOrder"),
  ),
  variableSpeedScheduleRule(
    "pressureTargetsPositive",
    "error",
    "mustBePositive",
    (control) =>
      control.schedule.every((point) => numericChecks.positive(point.target)),
    (control) => control.quantity === "pressure",
  ),
  variableSpeedScheduleRule(
    "timesDistinct",
    "warning",
    "mustNotRepeatTimes",
    (control) =>
      !validateTimeSequence(timesOf(control.schedule)).includes("repeated"),
  ),
];

const variableSpeedControlRules: Rule[] = [
  variableSpeedPressureTargetValuePositive,
  variableSpeedSpeedRule("minSpeed", "nonNegative"),
  variableSpeedSpeedRule("maxSpeed", "positive"),
  variableSpeedTankLevelSettingRule(
    "onBelowOff",
    "error",
    "mustBeBelowOffLevel",
    (errors) => !errors.includes("order"),
  ),
  variableSpeedTankLevelSettingRule(
    "withinTankLevels",
    "warning",
    "mustBeWithinLevelRange",
    (errors) => !errors.some(isOutOfRange),
  ),
];

const curvePointsValid = (
  entityType: EntityType,
  fieldName: string,
  appliesWhen?: When,
): Rule => ({
  id: `${entityType}.${fieldName}.valid`,
  type: "model",
  entityType,
  field: fieldName,
  accessor: field(fieldName),
  appliesWhen,
  check: (value, _entity, model) => {
    if (!model || !isFiniteNumber(value)) return true;
    const curve = model.curves.get(value);
    return (
      curve === undefined ||
      getCurveErrors(curve.type, curve.points).length === 0
    );
  },
  severity: "error",
  message: "invalidCurve",
});

const curvePointsRules: Rule[] = [
  curvePointsValid("tank", "volumeCurveId"),
  curvePointsValid("pump", "efficiencyCurveId"),
  curvePointsValid(
    "valve",
    "curveId",
    (entity) =>
      valveCurveTypeFrom(readEntityProp(entity, "kind") as ValveKind) !==
      undefined,
  ),
];

export const valveReferenceFields = [
  "targetNode",
  "flowModulatingSensorLink",
  "flowModulatingControlNode",
  "levelOpeningTank",
] as const;

export type ValveReferenceField = (typeof valveReferenceFields)[number];

export const pumpReferenceFields = [
  "variableSpeedPressureTarget",
  "variableSpeedFlowTarget",
  "variableSpeedLevelTarget",
  "variableSpeedLaggedPumps",
  "variableSpeedTankLevels",
] as const;

export type PumpReferenceField = (typeof pumpReferenceFields)[number];

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
  flowModulatingReferenceRule("sensorLink", "sensorLinkId"),
  flowModulatingReferenceRule("controlNode", "controlNodeId"),
  ...levelOpeningControlRules,
  {
    id: "valve.targetNode.active",
    type: "model",
    entityType: "valve",
    field: "targetNode",
    accessor: (entity) => readEntityProp(entity, "targetNodeId") ?? null,
    appliesWhen: (entity, model) =>
      isActiveEntity(entity) &&
      readEntityProp(entity, "kind") === "prv" &&
      !hasFlowModulatingControl(entity, model),
    check: (value, _entity, model) => {
      const target = model?.assets.get(value as AssetId);
      return !target || target.isActive;
    },
    severity: "error",
    message: "mustBeActive",
  },
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
  ...levelSettingControlRules,
  variableSpeedTargetRule("pressure", "Pressure"),
  variableSpeedTargetRule("flow", "Flow"),
  variableSpeedTargetRule("level", "Level"),
  {
    id: "pump.variableSpeedLaggedPumps.active",
    type: "model",
    entityType: "pump",
    field: "variableSpeedLaggedPumps",
    accessor: (entity, model) =>
      variableSpeedControlOf(entity, model)?.laggedPumpIds ?? [],
    appliesWhen: (entity, model) =>
      isActiveEntity(entity) &&
      (variableSpeedControlOf(entity, model)?.laggedPumpIds.length ?? 0) > 0,
    check: (value, _entity, model) =>
      (value as AssetId[]).every((id) => isActiveAsset(model, id)),
    severity: "error",
    message: "mustBeActive",
  },
  {
    id: "pump.variableSpeedTankLevels.active",
    type: "model",
    entityType: "pump",
    field: "variableSpeedTankLevels",
    accessor: (entity, model) =>
      variableSpeedControlOf(entity, model)?.tankLevels?.tankId ?? null,
    appliesWhen: (entity, model) =>
      isActiveEntity(entity) &&
      variableSpeedControlOf(entity, model)?.tankLevels != null,
    check: (value, _entity, model) =>
      value === null || isActiveAsset(model, value as AssetId),
    severity: "error",
    message: "mustBeActive",
  },
  ...variableSpeedControlRules,
  ...variableSpeedScheduleRules,
  ...timedSettingControlRules,
  ...curvePointsRules,
  variableSpeedDischargeNotBackfeeding,
  variableSpeedFlowTargetSameDirection,
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

export const RULES_DEPRECATED: Rule[] = RULES.filter(
  (rule) =>
    !levelSettingControlRules.includes(rule) &&
    !variableSpeedControlRules.includes(rule) &&
    !variableSpeedScheduleRules.includes(rule) &&
    !timedSettingControlRules.includes(rule) &&
    !curvePointsRules.includes(rule),
);
